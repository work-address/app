import { randomUUID } from 'crypto'
import { expect } from 'chai'
import axios from 'axios'
import * as fs from 'fs'
import * as path from 'path'
import { suite, test } from '@testdeck/mocha'

import {
  invoiceControllerEscrowSubmission,
  invoiceControllerMarkPaid,
  invoiceControllerRead,
  invoiceControllerSearch,
  projectControllerEdit,
} from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { Invoice } from '@/entity/invoice'
import { Project } from '@/entity/project'
import { User } from '@/entity/user'
import {
  EInvoiceState,
  IInvoiceCommitmentBinding,
  IInvoiceEscrowSubmissionRequest,
  IInvoiceRecord,
} from '@/model/invoice'
import { InvoiceCommitment } from '@/service/invoice-commitment'
import { InvoiceEscrow } from '@/service/invoice-escrow'
import { InvoiceRecord } from '@/service/invoice-record'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { ProjectRepository } from '@/repository/project-repository'
import { runPromise } from '@/service/effect-bridge'
import { WalletAddress } from '@/service/wallet-address'
import { InvoiceFixture } from '@/test/fixture/invoice-fixture'

type Period = { workStart: number; workEnd: number }

type Vector = IInvoiceCommitmentBinding & {
  name: string
  salt: string
  record: IInvoiceRecord
  commitment: string
  amount: string
}

const DAY = 86400

/** Where the local chain's escrow is deployed in the vectors. */
const ESCROW = '0x8bbc3514477d75ec797bbe4e19d7961660bb849c'

/**
 * GET /invoice/:id/escrow-submission: what the issuer hands MarketplaceEscrow
 * for an invoice - the amount in USDT base units and the InvoiceCommitment v1
 * - and the binding of the invoice to that allocation, which must be the one
 * funding the invoice's own marketplace contract.
 */
@suite()
export class InvoiceControllerEscrowSubmissionTest extends BaseControllerTest {
  protected invoiceRepository: InvoiceRepository
  protected projectRepository: ProjectRepository
  protected invoiceRecord: InvoiceRecord
  protected invoiceCommitment: InvoiceCommitment

  constructor() {
    super()

    this.invoiceRepository = this.container.get('InvoiceRepository')
    this.projectRepository = this.container.get('ProjectRepository')
    this.invoiceRecord = this.container.get('InvoiceRecord')
    this.invoiceCommitment = this.container.get('InvoiceCommitment')
  }

  private vectors(): Vector[] {
    return JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '../fixture/invoice-commitment.v1.json'),
        'utf8',
      ),
    ).vectors
  }

  private auth(user: User) {
    return { Authorization: this.authenticator.getTokens(user).accessToken }
  }

  /**
   * The request for the allocation the marketplace funds for `contractId`
   * over `period`, on the local chain's escrow unless told otherwise.
   */
  private requestFor(
    contractId: string,
    period: Period,
    chainId = 31337,
    escrow = ESCROW,
  ): IInvoiceEscrowSubmissionRequest {
    const request = { chainId, escrow, ...period, allocationId: '' }

    return {
      ...request,
      allocationId: InvoiceEscrow.contractPeriodAllocationId(
        contractId,
        request,
      ),
    }
  }

  /** A work period around the invoice's own, a day wider at each end. */
  private periodAround(invoice: Invoice): Period {
    return {
      workStart: Math.floor(new Date(invoice.fromAt).getTime() / 1000) - DAY,
      workEnd: Math.ceil(new Date(invoice.toAt).getTime() / 1000) + DAY,
    }
  }

  /** What the hired worker sends for `invoice` on `project`. */
  private request(
    invoice: Invoice,
    project: Project,
  ): IInvoiceEscrowSubmissionRequest {
    return this.requestFor(
      project.marketplaceContractId!,
      this.periodAround(invoice),
    )
  }

  private submit(
    invoice: Invoice,
    user: User,
    request: IInvoiceEscrowSubmissionRequest,
  ) {
    return invoiceControllerEscrowSubmission({
      client: this.apiClient(),
      path: { id: invoice.id as never },
      query: request,
      headers: this.auth(user),
      throwOnError: true,
    })
  }

  /** The status a refused call answered with. */
  private async statusOf(call: Promise<unknown>): Promise<number | undefined> {
    try {
      await call
    } catch (error: unknown) {
      if (!axios.isAxiosError(error)) {
        throw error
      }

      return error.response?.status
    }

    return 200
  }

  private async stored(id: string): Promise<Invoice> {
    const invoice = await runPromise(
      this.invoiceRepository.findOneBy({ where: { id } }),
    )

    return invoice!
  }

  /**
   * A client, the worker they hired on the marketplace, the project the hire
   * made, and an invoice the worker issued on it.
   */
  private async issued(amountCents = 3000) {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createHired(owner, worker, 20)
    const invoice = await this.invoiceFixture.createIssued(
      project,
      worker,
      amountCents,
    )

    return { owner, worker, project, invoice }
  }

  /**
   * The acceptance case: an invoice whose record is a WP-17 vector, submitted
   * to the vector's allocation under the vector's salt, yields exactly the
   * vector's commitment and on-chain amount - the bytes the contracts
   * repository proves MarketplaceEscrow takes.
   *
   * The salt is the one thing the service draws at random, so it is pinned
   * for this call only. So is the allocation's derivation: the vectors'
   * allocation ids predate it, so no contract and period derive them. The
   * pin still has to be asked about the vectors' contract and the period
   * sent, and the derivation itself is pinned to the marketplace's in
   * InvoiceEscrowTest; everything else is the live path.
   */
  @test()
  async issuer_getsTheVectorAmountAndCommitment() {
    const vectors = this.vectors().filter(
      (vector, index, all) =>
        all.findIndex(
          (other) => other.record.invoiceId === vector.record.invoiceId,
        ) === index,
    )
    const drawSalt = InvoiceEscrow.drawSalt
    const derive = InvoiceEscrow.contractPeriodAllocationId

    expect(vectors).to.have.length.greaterThan(1)

    for (const vector of vectors) {
      const invoice = await this.invoiceFixture.ensureForRecord(vector.record)
      const issuer = invoice.user!
      const period = {
        workStart: Date.parse(vector.record.periodStart) / 1000,
        workEnd: Date.parse(vector.record.periodEnd) / 1000 + 7 * DAY,
      }
      const asked: [string, Period][] = []

      InvoiceEscrow.drawSalt = () => vector.salt
      InvoiceEscrow.contractPeriodAllocationId = (contractId, request) => {
        asked.push([
          contractId,
          { workStart: request.workStart, workEnd: request.workEnd },
        ])

        return vector.allocationId
      }

      try {
        // Checksum-style casing in, lowercase committed: one allocation.
        const res = await this.submit(invoice, issuer, {
          chainId: vector.chainId,
          escrow: vector.escrow.toUpperCase().replace('0X', '0x'),
          allocationId: vector.allocationId.toUpperCase().replace('0X', '0x'),
          ...period,
        })

        expect(res.status, vector.name).to.be.eq(200)
        expect(res.data).to.deep.eq({
          invoiceId: vector.record.invoiceId,
          chainId: vector.chainId,
          escrow: vector.escrow,
          allocationId: vector.allocationId,
          amountBaseUnits: vector.amount,
          invoiceCommitment: vector.commitment,
          salt: vector.salt,
        })
        expect(asked).to.deep.eq([[InvoiceFixture.VECTOR_CONTRACT_ID, period]])
      } finally {
        InvoiceEscrow.drawSalt = drawSalt
        InvoiceEscrow.contractPeriodAllocationId = derive
      }

      const bound = await this.stored(invoice.id)

      expect(bound.escrowChainId).to.be.eq(vector.chainId)
      expect(bound.escrowAddress).to.be.eq(vector.escrow)
      expect(bound.escrowAllocationId).to.be.eq(vector.allocationId)
      expect(bound.escrowCommitment).to.be.eq(vector.commitment)
      expect(bound.escrowSalt).to.be.eq(vector.salt)
    }
  }

  /**
   * Off the vectors, with a salt the service really drew: the commitment is
   * the invoice's own record committed for that allocation under that salt,
   * and the salt is 32 non-zero bytes nobody else got.
   */
  @test()
  async issuer_getsTheCommitmentToTheInvoicesRecord() {
    const { worker, project, invoice } = await this.issued()
    const request = this.request(invoice, project)
    const binding: IInvoiceCommitmentBinding = {
      chainId: request.chainId,
      escrow: request.escrow,
      allocationId: request.allocationId,
    }

    const res = await this.submit(invoice, worker, request)
    const record = this.invoiceRecord.document(
      (await runPromise(
        this.invoiceRepository.findOneBy({
          where: { id: invoice.id },
          relations: { project: true, user: true },
        }),
      ))!,
    )

    expect(res.status).to.be.eq(200)
    expect(res.data?.salt).to.match(/^0x[\da-f]{64}$/)
    expect(res.data?.salt).to.not.eq(`0x${'0'.repeat(64)}`)
    expect(res.data?.invoiceCommitment).to.be.eq(
      this.invoiceCommitment.commit(record, binding, res.data!.salt),
    )
    expect(res.data?.amountBaseUnits).to.be.eq('30000000')
  }

  /**
   * Base units are cents times 10^4 in integer arithmetic. 12345 cents is the
   * case the plan names; 201 cents is one a float path gets wrong
   * ((201 / 100) * 1e6 is 2009999.9999999998); the largest amount the column
   * holds must survive too.
   */
  @test()
  async amount_isIntegerBaseUnitsWithNoFloat() {
    const cases: [number, string][] = [
      [12345, '123450000'],
      [201, '2010000'],
      [2147483647, '21474836470000'],
    ]

    for (const [amountCents, expected] of cases) {
      const { worker, project, invoice } = await this.issued(amountCents)
      const res = await this.submit(
        invoice,
        worker,
        this.request(invoice, project),
      )

      expect(res.status).to.be.eq(200)
      expect(res.data?.amountBaseUnits, `${amountCents} cents`).to.equal(
        expected,
      )
    }
  }

  /**
   * Only the issuer submits their bill. The project owner can read the
   * invoice but is the payer; anyone else cannot read it at all. Neither is
   * handed a commitment, and the invoice stays unbound.
   */
  @test()
  async nonIssuer_isRefused403AndNothingIsBound() {
    const { owner, project, invoice } = await this.issued()
    const outsider = await this.userFixture.createUser()

    for (const user of [owner, outsider]) {
      const status = await this.statusOf(
        this.submit(invoice, user, this.request(invoice, project)),
      )

      expect(status).to.be.eq(403)
    }

    expect((await this.stored(invoice.id)).escrowAllocationId).to.be.null
  }

  /**
   * An allocation takes one bill. Binding a second invoice to it is a 409,
   * and leaves both invoices as they were.
   */
  @test()
  async secondInvoiceOnTheSameAllocation_is409() {
    const { worker, project, invoice: first } = await this.issued()
    const second = await this.invoiceFixture.createIssued(project, worker, 900)
    const request = this.request(first, project)

    const bound = await this.submit(first, worker, request)
    const status = await this.statusOf(this.submit(second, worker, request))

    expect(bound.status).to.be.eq(200)
    expect(status).to.be.eq(409)
    expect((await this.stored(first.id)).escrowAllocationId).to.be.eq(
      request.allocationId,
    )
    expect((await this.stored(second.id)).escrowAllocationId).to.be.null
  }

  /**
   * Two invoices racing for one allocation: exactly one is bound, and the
   * other is told so.
   */
  @test()
  async racingInvoicesForOneAllocation_bindExactlyOne() {
    const { worker, project, invoice: first } = await this.issued()
    const second = await this.invoiceFixture.createIssued(project, worker, 900)
    const request = this.request(first, project)

    const statuses = await Promise.all(
      [first, second].map((invoice) =>
        this.statusOf(this.submit(invoice, worker, request)),
      ),
    )
    const holders = await runPromise(
      this.invoiceRepository.findBy({
        where: { escrowAllocationId: request.allocationId },
      }),
    )

    expect([...statuses].sort()).to.deep.eq([200, 409])
    expect(holders).to.have.length(1)
  }

  /**
   * The database itself refuses a second invoice on one allocation, whatever
   * code path writes it: the index is the guarantee, the service's check
   * only the friendly message.
   */
  @test()
  async uniqueIndex_refusesASecondInvoiceOnOneAllocation() {
    const { worker, project, invoice: first } = await this.issued()
    const second = await this.invoiceFixture.createIssued(project, worker, 900)
    const binding = this.request(first, project)

    await this.submit(first, worker, binding)

    let failure: unknown

    try {
      await this.invoiceRepository.getRepo().update(
        { id: second.id },
        {
          escrowChainId: binding.chainId,
          escrowAddress: binding.escrow,
          escrowAllocationId: binding.allocationId,
        },
      )
    } catch (error: unknown) {
      failure = error
    }

    expect((failure as { code?: string })?.code).to.be.eq('23505')
  }

  /**
   * Asking again for the same allocation returns the same submission - the
   * same salt and commitment - rather than a second commitment the chain
   * could be handed. Asking for another allocation is a 409, even one
   * funding the same contract over a period that also covers the invoice:
   * the invoice may already be billed through the first.
   */
  @test()
  async repeatSubmission_isStableAndTheBindingNeverMoves() {
    const { worker, project, invoice } = await this.issued()
    const request = this.request(invoice, project)
    const wider = this.requestFor(project.marketplaceContractId!, {
      workStart: request.workStart - DAY,
      workEnd: request.workEnd,
    })

    const first = await this.submit(invoice, worker, request)
    const again = await this.submit(invoice, worker, request)
    const elsewhere = await this.statusOf(this.submit(invoice, worker, wider))

    expect(first.status).to.be.eq(200)
    expect(again.data).to.deep.eq(first.data)
    expect(wider.allocationId).to.not.eq(request.allocationId)
    expect(elsewhere).to.be.eq(409)
    expect((await this.stored(invoice.id)).escrowAllocationId).to.be.eq(
      request.allocationId,
    )
  }

  /**
   * A legacy invoice has no record to commit to, and a paid one has nothing
   * left to bill: both 409, neither bound.
   */
  @test()
  async legacyAndPaidInvoices_are409() {
    const { worker, project, invoice: paid } = await this.issued()
    const legacy = await this.invoiceFixture.create(
      project,
      5000,
      EInvoiceState.REQUESTED,
    )

    legacy.user = worker
    await runPromise(this.invoiceRepository.saveSingle(legacy))

    await invoiceControllerMarkPaid({
      client: this.apiClient(),
      path: { id: paid.id as never },
      headers: this.auth(worker),
      throwOnError: true,
    })

    for (const invoice of [legacy, paid]) {
      const status = await this.statusOf(
        this.submit(invoice, worker, this.request(invoice, project)),
      )

      expect(status).to.be.eq(409)
      expect((await this.stored(invoice.id)).escrowAllocationId).to.be.null
    }
  }

  /**
   * An invoice for nothing - a fixed-price project's, at a rate of 0 - has
   * no bill to submit: MarketplaceEscrow reverts an amount of 0, so the
   * issuer is told here (409) rather than by a failed transaction, and the
   * invoice stays unbound.
   */
  @test()
  async zeroAmountInvoice_is409AndStaysUnbound() {
    const { worker, project, invoice } = await this.issued(0)

    const status = await this.statusOf(
      this.submit(invoice, worker, this.request(invoice, project)),
    )

    expect(status).to.be.eq(409)
    expect((await this.stored(invoice.id)).escrowAllocationId).to.be.null
  }

  /**
   * A malformed allocation, escrow or work period - including none at all,
   * which the allocation cannot be checked without - is a 400, before
   * anything is bound.
   */
  @test()
  async malformedAllocation_is400() {
    const { worker, project, invoice } = await this.issued()
    const valid = this.request(invoice, project)

    for (const query of [
      { ...valid, allocationId: '0x1234' },
      { ...valid, escrow: 'not-an-address' },
      { ...valid, chainId: 0 },
      { ...valid, workStart: undefined },
      { ...valid, workEnd: undefined },
      { ...valid, workStart: -1 },
      { ...valid, workEnd: valid.workEnd + 0.5 },
      // Derived as sent, so only the order of the ends is wrong.
      this.requestFor(project.marketplaceContractId!, {
        workStart: valid.workEnd,
        workEnd: valid.workStart,
      }),
    ]) {
      const status = await this.statusOf(
        invoiceControllerEscrowSubmission({
          client: this.apiClient(),
          path: { id: invoice.id as never },
          query: query as IInvoiceEscrowSubmissionRequest,
          headers: this.auth(worker),
          throwOnError: true,
        }),
      )

      expect(status, JSON.stringify(query)).to.be.eq(400)
    }

    expect((await this.stored(invoice.id)).escrowAllocationId).to.be.null
  }

  /**
   * Both parties see which allocation the invoice was submitted to and the
   * commitment - the owner checks it against the chain - but no invoice
   * response carries the salt, the issuer's included: it leaves only in the
   * issuer's own escrow submission.
   */
  @test()
  async binding_isVisibleToBothPartiesAndTheSaltToNeither() {
    const { owner, worker, project, invoice } = await this.issued()
    const binding = this.request(invoice, project)
    const submitted = await this.submit(invoice, worker, binding)

    for (const reader of [owner, worker]) {
      const read = await invoiceControllerRead({
        client: this.apiClient(),
        path: { id: invoice.id as never },
        headers: this.auth(reader),
        throwOnError: true,
      })
      const search = await invoiceControllerSearch({
        client: this.apiClient(),
        headers: this.auth(reader),
        body: {
          filter: { projectId: project.id },
          sort: { fromAt: 'DESC' },
          page: 0,
        },
        throwOnError: true,
      })
      const listed = (
        search.data[0] as unknown as Record<string, unknown>[]
      ).find((row) => row.id === invoice.id)

      for (const body of [read.data as Record<string, unknown>, listed!]) {
        expect(body.escrowChainId).to.be.eq(binding.chainId)
        expect(body.escrowAddress).to.be.eq(binding.escrow)
        expect(body.escrowAllocationId).to.be.eq(binding.allocationId)
        expect(body.escrowCommitment).to.be.eq(
          submitted.data?.invoiceCommitment,
        )
        expect(body).to.not.have.property('escrowSalt')
        expect(JSON.stringify(body)).to.not.contain(submitted.data!.salt)
      }
    }
  }

  /**
   * The squat review found: someone with no part in a contract asks to bind
   * an invoice of their own to the allocation funding the hired worker's
   * work, whose id and period are public once it is funded - first from a
   * personal project, then from a contract of their own they were hired on.
   * Both are 409 and bind nothing, and the hired worker's invoice still
   * binds to it.
   */
  @test()
  async outsider_cannotBindTheHiredWorkersAllocation() {
    const { worker, project, invoice } = await this.issued()
    const allocation = this.request(invoice, project)
    const outsider = await this.userFixture.createUser()
    const client = await this.userFixture.createUser()
    const personal = await this.projectFixture.createPersonal(outsider, 1)
    const hired = await this.projectFixture.createHired(client, outsider, 1)
    const squats = [
      await this.invoiceFixture.createIssued(personal, outsider, 1),
      await this.invoiceFixture.createIssued(hired, outsider, 1),
    ]

    for (const squat of squats) {
      const status = await this.statusOf(
        this.submit(squat, outsider, allocation),
      )

      expect(status).to.be.eq(409)
      expect((await this.stored(squat.id)).escrowAllocationId).to.be.null
    }

    const res = await this.submit(invoice, worker, allocation)

    expect(res.status).to.be.eq(200)
    expect((await this.stored(invoice.id)).escrowAllocationId).to.be.eq(
      allocation.allocationId,
    )
  }

  /**
   * The owner may invoice their own hours on the project they hired for,
   * but on its contract they are the payer: their invoice may not take the
   * allocation they funded (403), and the hired worker's still binds.
   */
  @test()
  async ownersInvoiceOnTheHiredProject_is403() {
    const { owner, worker, project, invoice } = await this.issued()
    const own = await this.invoiceFixture.createIssued(project, owner, 100)
    const allocation = this.request(invoice, project)

    const status = await this.statusOf(this.submit(own, owner, allocation))

    expect(status).to.be.eq(403)
    expect((await this.stored(own.id)).escrowAllocationId).to.be.null
    expect((await this.submit(invoice, worker, allocation)).status).to.be.eq(
      200,
    )
  }

  /**
   * BINDING-SQUAT: the owner edits the worker list, so a second worker the
   * owner adds is a worker too - but not whom the contract hired. Their
   * invoice for the contract's allocation is refused (403) and binds nothing,
   * so it cannot leave the freelancer's invoice refused for good, and the
   * freelancer's still binds. Editing the project cannot change who was
   * hired, whatever the body says.
   */
  @test()
  async aSecondWorkerTheOwnerAdded_cannotBindTheContractsAllocation() {
    const { owner, worker, project, invoice } = await this.issued()
    const allocation = this.request(invoice, project)
    const second = await this.userFixture.createUser()
    const secondAddress = WalletAddress.toCanonical(second.address)

    await projectControllerEdit({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: this.auth(owner),
      body: {
        workerAddresses: [...project.workerAddresses, secondAddress],
        marketplaceFreelancerAddress: secondAddress,
      } as never,
      throwOnError: true,
    })

    const edited = await runPromise(
      this.projectRepository.findOneByIdOrFail(project.id),
    )
    // Issued a moment after the freelancer's, over the same hour: inside
    // the period the allocation funds, a day wider at each end.
    const squat = await this.invoiceFixture.createIssued(
      edited,
      second,
      invoice.amountCents,
    )

    const refused = await this.statusOf(this.submit(squat, second, allocation))

    expect(edited.workerAddresses).to.include(secondAddress)
    expect(edited.isWorker(second)).to.be.true
    expect(edited.marketplaceFreelancerAddress).to.be.eq(
      WalletAddress.toCanonical(worker.address),
    )
    expect(refused).to.be.eq(403)
    expect((await this.stored(squat.id)).escrowAllocationId).to.be.null
    expect((await this.submit(invoice, worker, allocation)).status).to.be.eq(
      200,
    )
    expect(
      await this.statusOf(this.submit(squat, second, allocation)),
    ).to.be.oneOf([403, 409])
  }

  /**
   * A project hired before the freelancer was recorded on it cannot say who
   * the contract hired, so it binds nobody (409) rather than anyone on its
   * worker list.
   */
  @test()
  async aProjectThatNeverRecordedItsFreelancer_bindsNobody() {
    const { worker, project, invoice } = await this.issued()
    const allocation = this.request(invoice, project)

    project.marketplaceFreelancerAddress = null
    await runPromise(this.projectRepository.saveSingle(project))

    const status = await this.statusOf(this.submit(invoice, worker, allocation))

    expect(status).to.be.eq(409)
    expect((await this.stored(invoice.id)).escrowAllocationId).to.be.null
  }

  /**
   * Hired is a present fact: a worker taken off the project cannot submit
   * the invoices they issued while on it (403).
   */
  @test()
  async workerNoLongerOnTheProject_is403() {
    const { worker, project, invoice } = await this.issued()
    const allocation = this.request(invoice, project)

    project.workerAddresses = []
    await runPromise(this.projectRepository.saveSingle(project))

    const status = await this.statusOf(this.submit(invoice, worker, allocation))

    expect(status).to.be.eq(403)
    expect((await this.stored(invoice.id)).escrowAllocationId).to.be.null
  }

  /**
   * An allocation that funds anything but this contract's work over the
   * period sent is refused (409) and binds nothing: another contract's over
   * the same period, this contract's over another period, this one's on
   * another escrow or chain than the request names, or none at all. The
   * one it does fund still binds.
   */
  @test()
  async allocationOfAnotherContractOrPeriod_is409() {
    const { worker, project, invoice } = await this.issued()
    const allocation = this.request(invoice, project)
    const contractId = project.marketplaceContractId!
    const period = {
      workStart: allocation.workStart,
      workEnd: allocation.workEnd,
    }
    const others: [string, string][] = [
      ['contract', this.requestFor(randomUUID(), period).allocationId],
      [
        'period',
        this.requestFor(contractId, {
          ...period,
          workStart: period.workStart - DAY,
        }).allocationId,
      ],
      [
        'escrow',
        this.requestFor(contractId, period, 31337, `0x${'11'.repeat(20)}`)
          .allocationId,
      ],
      ['chain', this.requestFor(contractId, period, 1).allocationId],
      ['random', `0x${'ab'.repeat(32)}`],
    ]

    for (const [other, allocationId] of others) {
      const status = await this.statusOf(
        this.submit(invoice, worker, { ...allocation, allocationId }),
      )

      expect(allocationId, other).to.not.eq(allocation.allocationId)
      expect(status, other).to.be.eq(409)
    }

    expect((await this.stored(invoice.id)).escrowAllocationId).to.be.null
    expect((await this.submit(invoice, worker, allocation)).status).to.be.eq(
      200,
    )
  }

  /**
   * An allocation pays for its own period's work: an invoice whose period
   * is not inside the work period is refused (409), though the allocation
   * is the contract's for that period. Both ends count as inside.
   */
  @test()
  async invoiceOutsideTheWorkPeriod_is409AndItsEndsAreInside() {
    const { worker, project, invoice } = await this.issued()
    const contractId = project.marketplaceContractId!
    // Whole minutes, so whole seconds.
    const fromAt = new Date(invoice.fromAt).getTime() / 1000
    const toAt = new Date(invoice.toAt).getTime() / 1000

    for (const period of [
      { workStart: toAt, workEnd: toAt + 7 * DAY },
      { workStart: fromAt - 7 * DAY, workEnd: fromAt },
      { workStart: fromAt + 60, workEnd: toAt + DAY },
      { workStart: fromAt - DAY, workEnd: toAt - 60 },
    ]) {
      const status = await this.statusOf(
        this.submit(invoice, worker, this.requestFor(contractId, period)),
      )

      expect(status, JSON.stringify(period)).to.be.eq(409)
    }

    expect((await this.stored(invoice.id)).escrowAllocationId).to.be.null

    const exact = this.requestFor(contractId, {
      workStart: fromAt,
      workEnd: toAt,
    })

    expect((await this.submit(invoice, worker, exact)).status).to.be.eq(200)
    expect((await this.stored(invoice.id)).escrowAllocationId).to.be.eq(
      exact.allocationId,
    )
  }

  /**
   * A project made here directly - the issuer a worker on it - was hired
   * for no marketplace contract, so no allocation funds its invoices: 409,
   * whatever allocation and period the request names.
   */
  @test()
  async invoiceOnAProjectNoContractHiredFor_is409() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 20)

    project.workerAddresses = [worker.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const invoice = await this.invoiceFixture.createIssued(project, worker, 900)
    const status = await this.statusOf(
      this.submit(
        invoice,
        worker,
        this.requestFor(randomUUID(), this.periodAround(invoice)),
      ),
    )

    expect(status).to.be.eq(409)
    expect((await this.stored(invoice.id)).escrowAllocationId).to.be.null
  }
}
