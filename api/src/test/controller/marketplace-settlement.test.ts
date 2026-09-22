import { randomUUID } from 'crypto'
import axios from 'axios'
import * as fs from 'fs'
import * as path from 'path'
import moment from 'moment'
import { expect } from 'chai'
import { suite, test } from '@testdeck/mocha'

import {
  helpControllerSwagger,
  invoiceControllerCreate,
  invoiceControllerEscrowSubmission,
  invoiceControllerMarkPaid,
  invoiceControllerMarkUnpaid,
  invoiceControllerRead,
  invoiceControllerSearch,
} from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { Invoice } from '@/entity/invoice'
import { User } from '@/entity/user'
import {
  EInvoiceEscrowState,
  EInvoiceSettlementKind,
  EInvoiceState,
  IInvoiceCommitmentBinding,
  IInvoiceRecord,
} from '@/model/invoice'
import { MarketplaceSettlementController } from '@/controller/marketplace-settlement-controller'
import { EntitlementSignature } from '@/service/entitlement-signature'
import { InternalRoute } from '@/service/internal-route'
import { InvoiceEscrow } from '@/service/invoice-escrow'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeRepository } from '@/repository/time-repository'
import { runPromise } from '@/service/effect-bridge'

type Body = Record<string, unknown>

type Bound = {
  owner: User
  worker: User
  invoice: Invoice
  binding: IInvoiceCommitmentBinding
  commitment: string
  amountBaseUnits: string
  /** The escrow and work period the invoice was submitted for. */
  request: {
    chainId: number
    escrow: string
    workStart: number
    workEnd: number
  }
}

/**
 * POST /api/internal/marketplace/settlement: the marketplace's escrow indexer
 * reports how the allocation an invoice is bound to settled, and the invoice
 * records it - PAID with its hours on a release, refunded and still unpaid on
 * a dispute.
 */
@suite()
export class MarketplaceSettlementControllerTest extends BaseControllerTest {
  protected signature: EntitlementSignature
  protected invoiceRepository: InvoiceRepository
  protected projectRepository: ProjectRepository
  protected timeRepository: TimeRepository

  constructor() {
    super()

    this.signature = this.container.get('EntitlementSignature')
    this.invoiceRepository = this.container.get('InvoiceRepository')
    this.projectRepository = this.container.get('ProjectRepository')
    this.timeRepository = this.container.get('TimeRepository')
  }

  private fixture(): {
    path: string
    header: string
    body: Body
  } {
    return JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '../fixture/marketplace-settlement.contract.json'),
        'utf8',
      ),
    )
  }

  private auth(user: User) {
    return { Authorization: this.authenticator.getTokens(user).accessToken }
  }

  private post(
    body: Body,
    signature?: string,
    header = MarketplaceSettlementController.SIGNATURE_HEADER,
  ) {
    const raw = JSON.stringify(body)

    return axios.post(`${this.url}/api/internal/marketplace/settlement`, raw, {
      headers: {
        'Content-Type': 'application/json',
        [header]:
          signature ?? this.signature.sign(InternalRoute.SETTLEMENT, raw),
      },
      validateStatus: () => true,
    })
  }

  private postReversal(body: Body, signature?: string) {
    const raw = JSON.stringify(body)

    return axios.post(
      `${this.url}/api/internal/marketplace/settlement-reversal`,
      raw,
      {
        headers: {
          'Content-Type': 'application/json',
          [MarketplaceSettlementController.REVERSAL_SIGNATURE_HEADER]:
            signature ??
            this.signature.sign(InternalRoute.SETTLEMENT_REVERSAL, raw),
        },
        validateStatus: () => true,
      },
    )
  }

  private postBinding(body: Body, signature?: string) {
    const raw = JSON.stringify(body)

    return axios.post(
      `${this.url}/api/internal/marketplace/escrow-binding`,
      raw,
      {
        headers: {
          'Content-Type': 'application/json',
          [MarketplaceSettlementController.BINDING_SIGNATURE_HEADER]:
            signature ?? this.signature.sign(InternalRoute.ESCROW_BINDING, raw),
        },
        validateStatus: () => true,
      },
    )
  }

  /** The marketplace's lookup of `binding`, in the wire order of the shared fixture. */
  private bindingLookup(binding: IInvoiceCommitmentBinding): Body {
    return this.fresh({
      chainId: binding.chainId,
      escrow: binding.escrow,
      allocationId: binding.allocationId,
      issuedAt: 0,
      nonce: '',
    })
  }

  /**
   * The reversal the marketplace sends once the chain no longer holds the
   * settlement `push` carried, in the wire order of the shared fixture.
   */
  private reversalOf(push: Body, overrides: Body = {}): Body {
    return this.fresh({
      invoiceId: push.invoiceId,
      chainId: push.chainId,
      escrow: push.escrow,
      allocationId: push.allocationId,
      escrowState: push.escrowState,
      grossBaseUnits: push.grossBaseUnits,
      feeBaseUnits: push.feeBaseUnits,
      netBaseUnits: push.netBaseUnits,
      refundedBaseUnits: push.refundedBaseUnits,
      txHash: push.txHash,
      issuedAt: 0,
      nonce: '',
      ...overrides,
    })
  }

  /** A fresh replay guard, in the same key positions. */
  private fresh(body: Body): Body {
    return {
      ...body,
      issuedAt: Math.floor(Date.now() / 1000),
      nonce: randomUUID(),
    }
  }

  /**
   * The push the indexer sends for `bound` in `state`, in the wire order of
   * the shared fixture. A release pays the whole bill, 5% to the fee.
   */
  private settlement(
    bound: Bound,
    state: EInvoiceEscrowState,
    overrides: Body = {},
  ): Body {
    const gross = BigInt(bound.amountBaseUnits)
    const fee = (gross * BigInt(500)) / BigInt(10000)
    const released = state === EInvoiceEscrowState.RELEASED
    const disputed = state === EInvoiceEscrowState.DISPUTED_REFUNDED
    const settled = state !== EInvoiceEscrowState.SUBMITTED

    return this.fresh({
      invoiceId: bound.invoice.id,
      chainId: bound.binding.chainId,
      escrow: bound.binding.escrow,
      allocationId: bound.binding.allocationId,
      invoiceCommitment: bound.commitment,
      escrowState: state,
      grossBaseUnits: gross.toString(),
      feeBaseUnits: released ? fee.toString() : '0',
      netBaseUnits: released ? (gross - fee).toString() : '0',
      refundedBaseUnits: disputed ? gross.toString() : '0',
      txHash: settled ? this.bytes32() : null,
      confirmedAt: settled ? 1788865200 : null,
      issuedAt: 0,
      nonce: '',
      ...overrides,
    })
  }

  private bytes32(): string {
    return `0x${Buffer.from(
      Array.from({ length: 32 }, () => Math.floor(Math.random() * 256)),
    ).toString('hex')}`
  }

  /**
   * A hired worker's invoice for three half-hour entries of 30 active
   * minutes at $20/h - 3000 cents - raised through the API, and submitted
   * through the API to the allocation funding their contract's work that
   * day. One clock read for every bound.
   */
  private async bound(): Promise<Bound> {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createHired(owner, worker, 20)

    const start = moment.utc().startOf('minute').subtract(150, 'minutes')

    for (const offset of [0, 30, 60]) {
      const time = await this.timeFixture.create(
        project,
        start.clone().add(offset, 'minutes').toDate(),
        start
          .clone()
          .add(offset + 30, 'minutes')
          .toDate(),
        worker,
      )

      time.minutesActive = 30
      await runPromise(this.timeRepository.saveSingle(time))
    }

    const created = await invoiceControllerCreate({
      client: this.apiClient(),
      path: { projectId: project.id as never },
      headers: this.auth(worker),
      body: {},
      throwOnError: true,
    })
    const request = {
      chainId: 31337,
      escrow: '0x8bbc3514477d75ec797bbe4e19d7961660bb849c',
      workStart: start.clone().subtract(1, 'day').unix(),
      workEnd: start.clone().add(1, 'day').unix(),
    }
    const binding = {
      chainId: request.chainId,
      escrow: request.escrow,
      allocationId: InvoiceEscrow.contractPeriodAllocationId(
        project.marketplaceContractId!,
        { ...request, allocationId: '' },
      ),
    }
    const submission = await invoiceControllerEscrowSubmission({
      client: this.apiClient(),
      path: { id: created.data.id as never },
      query: { ...request, ...binding },
      headers: this.auth(worker),
      throwOnError: true,
    })

    return {
      owner,
      worker,
      invoice: await this.stored(created.data.id!),
      binding,
      commitment: submission.data.invoiceCommitment,
      amountBaseUnits: submission.data.amountBaseUnits,
      request,
    }
  }

  /**
   * Asks for the escrow submission of `bound`'s invoice for the work period
   * `period`, on the same escrow; the status, and the submission on a 200.
   */
  private async submitFor(
    bound: Bound,
    period: { workStart: number; workEnd: number },
  ): Promise<{ status: number; data: Body }> {
    const request = { ...bound.request, ...period }
    const allocationId = InvoiceEscrow.contractPeriodAllocationId(
      bound.invoice.project.marketplaceContractId!,
      { ...request, allocationId: '' },
    )
    const res = await axios.get(
      `${this.url}/api/invoice/${bound.invoice.id}/escrow-submission`,
      {
        params: { ...request, allocationId },
        headers: this.auth(bound.worker),
        validateStatus: () => true,
      },
    )

    return { status: res.status, data: res.data }
  }

  /** The push of an allocation that ended without a bill. */
  private lapse(
    bound: Bound,
    state: EInvoiceEscrowState,
    overrides: Body = {},
  ) {
    return this.settlement(bound, state, {
      invoiceCommitment: null,
      grossBaseUnits: '0',
      feeBaseUnits: '0',
      netBaseUnits: '0',
      refundedBaseUnits: '40000000',
      ...overrides,
    })
  }

  private markByHand(bound: Bound, paid: boolean) {
    return this.statusOf(
      (paid ? invoiceControllerMarkPaid : invoiceControllerMarkUnpaid)({
        client: this.apiClient(),
        path: { id: bound.invoice.id as never },
        headers: this.auth(bound.worker),
        throwOnError: true,
      }),
    )
  }

  private async stored(id: string): Promise<Invoice> {
    const invoice = await runPromise(
      this.invoiceRepository.findOneBy({
        where: { id },
        relations: { project: true, user: true },
      }),
    )

    return invoice!
  }

  private async hoursPaid(invoice: Invoice): Promise<boolean[]> {
    const times = await runPromise(this.timeRepository.findForInvoice(invoice))

    return times.map((time) => Boolean(time.isPaid))
  }

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

  /**
   * The acceptance case: a confirmed release makes the invoice PAID, dates
   * the payment at the release block, records the 95/5 split and the
   * transaction, and marks every hour it bills paid.
   */
  @test()
  async release_paysTheInvoiceAtBlockTimeAndItsHours() {
    const bound = await this.bound()
    const push = this.settlement(bound, EInvoiceEscrowState.RELEASED)

    expect(await this.hoursPaid(bound.invoice)).to.deep.eq([
      false,
      false,
      false,
    ])

    const res = await this.post(push)
    const invoice = await this.stored(bound.invoice.id)

    expect(res.status).to.be.eq(200)
    expect(res.data).to.deep.eq({
      applied: true,
      invoiceId: bound.invoice.id,
      state: EInvoiceState.PAID,
      escrowState: EInvoiceEscrowState.RELEASED,
    })
    expect(invoice.state).to.be.eq(EInvoiceState.PAID)
    expect(invoice.paidAt?.toISOString()).to.be.eq('2026-09-08T11:00:00.000Z')
    expect(invoice.settlementKind).to.be.eq(EInvoiceSettlementKind.ESCROW)
    expect(invoice.escrowState).to.be.eq(EInvoiceEscrowState.RELEASED)
    expect(invoice.escrowGrossBaseUnits).to.be.eq('30000000')
    expect(invoice.escrowFeeBaseUnits).to.be.eq('1500000')
    expect(invoice.escrowNetBaseUnits).to.be.eq('28500000')
    expect(invoice.escrowRefundedBaseUnits).to.be.eq('0')
    expect(invoice.escrowTxHash).to.be.eq(push.txHash)
    expect(invoice.escrowConfirmedAt?.toISOString()).to.be.eq(
      '2026-09-08T11:00:00.000Z',
    )
    expect(await this.hoursPaid(invoice)).to.deep.eq([true, true, true])
  }

  /**
   * What the escrow settled is part of the invoice both parties read - by id
   * and in the list - so the pages can show the split and the transaction.
   * A project viewer reads no invoice at all, settled or not.
   */
  @test()
  async settlement_isReadByBothPartiesAndNoViewer() {
    const bound = await this.bound()
    const viewer = await this.userFixture.createUser()
    const project = bound.invoice.project

    project.viewerAddresses = [viewer.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const push = this.settlement(bound, EInvoiceEscrowState.RELEASED, {
      refundedBaseUnits: '2000000',
    })

    expect((await this.post(push)).status).to.be.eq(200)

    const expected = {
      settlementKind: EInvoiceSettlementKind.ESCROW,
      escrowState: EInvoiceEscrowState.RELEASED,
      escrowGrossBaseUnits: '30000000',
      escrowFeeBaseUnits: '1500000',
      escrowNetBaseUnits: '28500000',
      escrowRefundedBaseUnits: '2000000',
      escrowTxHash: push.txHash,
      escrowConfirmedAt: '2026-09-08T11:00:00.000Z',
      paidAt: '2026-09-08T11:00:00.000Z',
    }
    const search = (user: User) =>
      invoiceControllerSearch({
        client: this.apiClient(),
        headers: this.auth(user),
        body: {
          filter: { projectId: project.id },
          sort: { fromAt: 'DESC' },
          page: 0,
        },
        throwOnError: true,
      })

    for (const reader of [bound.owner, bound.worker]) {
      const read = await invoiceControllerRead({
        client: this.apiClient(),
        path: { id: bound.invoice.id as never },
        headers: this.auth(reader),
        throwOnError: true,
      })
      const listed = (
        (await search(reader)).data[0] as unknown as Record<string, unknown>[]
      ).find((row) => row.id === bound.invoice.id)

      for (const body of [read.data as Record<string, unknown>, listed!]) {
        expect(body).to.include(expected)
      }
    }

    const viewerRead = await this.statusOf(
      invoiceControllerRead({
        client: this.apiClient(),
        path: { id: bound.invoice.id as never },
        headers: this.auth(viewer),
        throwOnError: true,
      }),
    )

    expect(viewerRead).to.be.eq(403)
    expect((await search(viewer)).data[0]).to.deep.eq([])
  }

  /**
   * The indexer retries until it is acknowledged, signing each attempt
   * afresh: the same settlement again is a 200 that changes nothing. The
   * very same signed request again is a replay, and refused.
   */
  @test()
  async replay_isIdempotentAndTheSameSignedRequestIsRefused() {
    const bound = await this.bound()
    const push = this.settlement(bound, EInvoiceEscrowState.RELEASED)

    const first = await this.post(push)
    const paid = await this.stored(bound.invoice.id)
    const retry = await this.post(this.fresh(push))
    const replay = await this.post(push)
    const after = await this.stored(bound.invoice.id)

    expect(first.status).to.be.eq(200)
    expect(retry.status).to.be.eq(200)
    expect(retry.data.applied).to.be.false
    expect(retry.data.state).to.be.eq(EInvoiceState.PAID)
    expect(replay.status).to.be.eq(401)
    expect(after.state).to.be.eq(EInvoiceState.PAID)
    expect(after.paidAt?.toISOString()).to.be.eq(paid.paidAt?.toISOString())
    expect(after.updatedAt.toISOString()).to.be.eq(paid.updatedAt.toISOString())
  }

  /**
   * A bad signature, a stale timestamp, and a signature under the hire's
   * header are all 401, and none of them touches the invoice.
   */
  @test()
  async unauthenticatedPushes_are401AndChangeNothing() {
    const bound = await this.bound()
    const push = this.settlement(bound, EInvoiceEscrowState.RELEASED)

    const forged = await this.post(push, 'deadbeef')
    const stale = await this.post({
      ...push,
      issuedAt: Math.floor(Date.now() / 1000) - 3600,
    })
    const hireHeader = await this.post(
      this.fresh(push),
      undefined,
      'X-Marketplace-Signature',
    )
    const invoice = await this.stored(bound.invoice.id)

    expect(forged.status).to.be.eq(401)
    expect(stale.status).to.be.eq(401)
    expect(hireHeader.status).to.be.eq(401)
    expect(invoice.state).to.be.eq(EInvoiceState.REQUESTED)
    expect(invoice.escrowState ?? null).to.be.null
    expect(await this.hoursPaid(invoice)).to.deep.eq([false, false, false])
  }

  /**
   * A dispute refund leaves the invoice refunded and unpaid, its hours
   * unpaid, and nobody can mark it paid - or unpaid - by hand: the escrow
   * decided it.
   */
  @test()
  async disputeRefund_leavesItRefundedAndNotPayableByHand() {
    const bound = await this.bound()
    const res = await this.post(
      this.settlement(bound, EInvoiceEscrowState.DISPUTED_REFUNDED),
    )
    const invoice = await this.stored(bound.invoice.id)

    expect(res.status).to.be.eq(200)
    expect(invoice.state).to.be.eq(EInvoiceState.REQUESTED)
    expect(invoice.paidAt ?? null).to.be.null
    expect(invoice.escrowState).to.be.eq(EInvoiceEscrowState.DISPUTED_REFUNDED)
    expect(invoice.escrowRefundedBaseUnits).to.be.eq('30000000')
    expect(invoice.settlementKind).to.be.eq(EInvoiceSettlementKind.ESCROW)
    expect(await this.hoursPaid(invoice)).to.deep.eq([false, false, false])

    for (const mark of [
      invoiceControllerMarkPaid,
      invoiceControllerMarkUnpaid,
    ]) {
      const status = await this.statusOf(
        mark({
          client: this.apiClient(),
          path: { id: bound.invoice.id as never },
          headers: this.auth(bound.worker),
          throwOnError: true,
        }),
      )

      expect(status).to.be.eq(409)
    }

    const after = await this.stored(bound.invoice.id)

    expect(after.state).to.be.eq(EInvoiceState.REQUESTED)
    expect(await this.hoursPaid(after)).to.deep.eq([false, false, false])
  }

  /**
   * Bound is enough: once submitted, only the escrow's outcome settles the
   * invoice, so the issuer's hand mark is a 409 before any push arrives, and
   * reverting a release by hand is a 409 after.
   */
  @test()
  async escrowBoundInvoice_refusesHandMarksBeforeAndAfterRelease() {
    const bound = await this.bound()
    const mark = (call: typeof invoiceControllerMarkPaid) =>
      this.statusOf(
        call({
          client: this.apiClient(),
          path: { id: bound.invoice.id as never },
          headers: this.auth(bound.worker),
          throwOnError: true,
        }),
      )

    expect(await mark(invoiceControllerMarkPaid)).to.be.eq(409)
    expect((await this.stored(bound.invoice.id)).state).to.be.eq(
      EInvoiceState.REQUESTED,
    )

    await this.post(this.settlement(bound, EInvoiceEscrowState.RELEASED))

    expect(await mark(invoiceControllerMarkUnpaid)).to.be.eq(409)
    expect((await this.stored(bound.invoice.id)).state).to.be.eq(
      EInvoiceState.PAID,
    )
  }

  /**
   * An invoice never submitted to escrow is still marked by hand, and the
   * record says so.
   */
  @test()
  async unboundInvoice_isStillMarkedByHandAsManual() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 20)
    const invoice = await this.invoiceFixture.createIssued(project, owner, 500)

    const paid = await invoiceControllerMarkPaid({
      client: this.apiClient(),
      path: { id: invoice.id as never },
      headers: this.auth(owner),
      throwOnError: true,
    })

    expect(paid.data.state).to.be.eq(EInvoiceState.PAID)
    expect((await this.stored(invoice.id)).settlementKind).to.be.eq(
      EInvoiceSettlementKind.MANUAL,
    )

    await invoiceControllerMarkUnpaid({
      client: this.apiClient(),
      path: { id: invoice.id as never },
      headers: this.auth(owner),
      throwOnError: true,
    })

    expect((await this.stored(invoice.id)).settlementKind ?? null).to.be.null
  }

  /**
   * Pushes arrive out of order under retry. The allocation's state only
   * moves forward: a SUBMITTED push after the release changes nothing, a
   * remainder refund after it is recorded without touching the payment, and
   * a second final state is a conflict.
   */
  @test()
  async settlement_onlyMovesForward() {
    const bound = await this.bound()
    const release = this.settlement(bound, EInvoiceEscrowState.RELEASED)

    const submitted = this.settlement(bound, EInvoiceEscrowState.SUBMITTED, {
      refundedBaseUnits: '5000000',
    })
    const early = await this.post(submitted)
    const released = await this.post(release)
    const late = await this.post(this.fresh(submitted))
    const remainder = await this.post(
      this.fresh({ ...release, refundedBaseUnits: '7000000' }),
    )
    const shrunk = await this.post(
      this.fresh({ ...release, refundedBaseUnits: '1' }),
    )
    const disputed = await this.post(
      this.settlement(bound, EInvoiceEscrowState.DISPUTED_REFUNDED),
    )
    const otherTx = await this.post(
      this.fresh({ ...release, txHash: this.bytes32() }),
    )
    const invoice = await this.stored(bound.invoice.id)

    expect(early.data.applied).to.be.true
    expect(early.data.state).to.be.eq(EInvoiceState.REQUESTED)
    expect(released.data.applied).to.be.true
    expect(late.status).to.be.eq(200)
    expect(late.data.applied).to.be.false
    expect(remainder.data.applied).to.be.true
    expect(shrunk.data.applied).to.be.false
    expect(disputed.status).to.be.eq(409)
    expect(otherTx.status).to.be.eq(409)
    expect(invoice.state).to.be.eq(EInvoiceState.PAID)
    expect(invoice.escrowState).to.be.eq(EInvoiceEscrowState.RELEASED)
    expect(invoice.escrowRefundedBaseUnits).to.be.eq('7000000')
    expect(invoice.escrowTxHash).to.be.eq(release.txHash)
    expect(invoice.paidAt?.toISOString()).to.be.eq('2026-09-08T11:00:00.000Z')
  }

  /**
   * The push must be about this invoice's bill: the invoice it names must
   * exist here, be submitted, to that allocation, and the allocation must
   * hold this invoice's commitment. Anything else is a 409 that pays
   * nothing.
   */
  @test()
  async pushForAnotherBill_is409AndPaysNothing() {
    const bound = await this.bound()
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 20)
    const unbound = await this.invoiceFixture.createIssued(project, owner, 500)
    const released = EInvoiceEscrowState.RELEASED

    const cases: [string, Body][] = [
      [
        'unknown invoice',
        this.settlement(bound, released, { invoiceId: randomUUID() }),
      ],
      [
        'never submitted',
        this.settlement(bound, released, { invoiceId: unbound.id }),
      ],
      [
        'another allocation',
        this.settlement(bound, released, { allocationId: this.bytes32() }),
      ],
      ['another escrow', this.settlement(bound, released, { chainId: 1 })],
      [
        'another commitment',
        this.settlement(bound, released, { invoiceCommitment: this.bytes32() }),
      ],
    ]

    for (const [name, push] of cases) {
      const res = await this.post(push)

      expect(res.status, name).to.be.eq(409)
    }

    const invoice = await this.stored(bound.invoice.id)

    expect(invoice.state).to.be.eq(EInvoiceState.REQUESTED)
    expect(await this.hoursPaid(invoice)).to.deep.eq([false, false, false])
    expect((await this.stored(unbound.id)).state).to.be.eq(
      EInvoiceState.REQUESTED,
    )
  }

  /**
   * A push the escrow could not have produced is a 400: amounts that do not
   * add up, a payout outside a release, a settled state with no transaction,
   * or a missing key.
   */
  @test()
  async impossibleSettlement_is400() {
    const bound = await this.bound()
    const released = EInvoiceEscrowState.RELEASED
    const cases: [string, Body][] = [
      [
        'net and fee exceed gross',
        this.settlement(bound, released, { netBaseUnits: '29000000' }),
      ],
      [
        'dispute with a payout',
        this.settlement(bound, EInvoiceEscrowState.DISPUTED_REFUNDED, {
          netBaseUnits: '1',
        }),
      ],
      [
        'released without a transaction',
        this.settlement(bound, released, { txHash: null }),
      ],
      [
        'expired with a bill',
        this.settlement(bound, EInvoiceEscrowState.EXPIRED_REFUNDED),
      ],
      [
        'a float amount',
        this.settlement(bound, released, { grossBaseUnits: '30000000.5' }),
      ],
    ]
    const missing = this.settlement(bound, released)

    delete missing.invoiceCommitment
    cases.push(['no commitment key', missing])

    for (const [name, push] of cases) {
      const res = await this.post(push)

      expect(res.status, name).to.be.eq(400)
    }

    expect((await this.stored(bound.invoice.id)).state).to.be.eq(
      EInvoiceState.REQUESTED,
    )
  }

  /**
   * The shared contract fixture, as the marketplace signs it, is accepted:
   * its invoice - the first commitment vector's, bound under the vector's
   * salt so the commitments agree - is paid at the fixture's block time.
   * Only the replay guard is renewed, in place, so the bytes keep their
   * order. The vector's allocation id predates the contract-period
   * derivation, so the derivation is pinned to it for the binding call.
   */
  @test()
  async contractFixture_isAcceptedAndPaysItsInvoice() {
    const fixture = this.fixture()
    const vector = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '../fixture/invoice-commitment.v1.json'),
        'utf8',
      ),
    ).vectors[0] as IInvoiceCommitmentBinding & {
      salt: string
      record: IInvoiceRecord
    }
    const invoice = await this.invoiceFixture.ensureForRecord(vector.record)
    const drawSalt = InvoiceEscrow.drawSalt
    const derive = InvoiceEscrow.contractPeriodAllocationId

    InvoiceEscrow.drawSalt = () => vector.salt
    InvoiceEscrow.contractPeriodAllocationId = () => vector.allocationId

    try {
      await invoiceControllerEscrowSubmission({
        client: this.apiClient(),
        path: { id: invoice.id as never },
        query: {
          chainId: vector.chainId,
          escrow: vector.escrow,
          allocationId: vector.allocationId,
          workStart: Date.parse(vector.record.periodStart) / 1000,
          workEnd: Date.parse(vector.record.periodEnd) / 1000,
        },
        headers: this.auth(invoice.user!),
        throwOnError: true,
      })
    } finally {
      InvoiceEscrow.drawSalt = drawSalt
      InvoiceEscrow.contractPeriodAllocationId = derive
    }

    const push = this.fresh(fixture.body)
    const raw = JSON.stringify(push)
    const res = await axios.post(`${this.url}${fixture.path}`, raw, {
      headers: {
        'Content-Type': 'application/json',
        [fixture.header]: this.signature.sign(InternalRoute.SETTLEMENT, raw),
      },
      validateStatus: () => true,
    })
    const paid = await this.stored(invoice.id)

    expect(Object.keys(push)).to.deep.eq(Object.keys(fixture.body))
    expect(res.status).to.be.eq(200)
    expect(res.data.applied).to.be.true
    expect(paid.state).to.be.eq(EInvoiceState.PAID)
    expect(paid.paidAt?.getTime()).to.be.eq(
      (fixture.body.confirmedAt as number) * 1000,
    )
    expect(paid.escrowNetBaseUnits).to.be.eq(fixture.body.netBaseUnits)
  }

  /**
   * The route answers - an unsigned push is refused, not unknown - yet the
   * public spec, which both browser clients are generated from, has neither
   * it nor the body it takes.
   */
  @test()
  async route_isServedButLeftOutOfThePublicSpec() {
    const unsigned = await axios.post(
      `${this.url}/api/internal/marketplace/settlement`,
      this.fixture().body,
      { validateStatus: () => true },
    )
    const res = await helpControllerSwagger({
      client: this.apiClient(),
      throwOnError: true,
    })
    const spec = res.data as {
      paths: Record<string, unknown>
      components: { schemas: Record<string, unknown> }
    }

    expect(unsigned.status).to.be.eq(401)
    expect(spec.paths).to.not.have.property(
      '/api/internal/marketplace/settlement',
    )
    expect(spec.components.schemas).to.not.have.property(
      'MarketplaceSettlementDto',
    )
  }
  /**
   * REORG-COMPENSATION: a release recorded here that a reorganisation takes
   * off the chain is undone. The invoice is unpaid again with its hours,
   * records no outcome, keeps its binding and commitment - the bill may be
   * mined again - and is still not markable by hand. The release mined
   * again in another transaction then pays it as the first push did.
   */
  @test()
  async reversal_ofARelease_unpaysTheInvoiceAndItsHoursAndKeepsTheBinding() {
    const bound = await this.bound()
    const release = this.settlement(bound, EInvoiceEscrowState.RELEASED)

    expect((await this.post(release)).data.applied).to.be.true
    expect(await this.hoursPaid(bound.invoice)).to.deep.eq([true, true, true])

    const res = await this.postReversal(this.reversalOf(release))
    const invoice = await this.stored(bound.invoice.id)

    expect(res.status, JSON.stringify(res.data)).to.be.eq(200)
    expect(res.data).to.deep.eq({
      applied: true,
      invoiceId: bound.invoice.id,
      state: EInvoiceState.REQUESTED,
      escrowState: null,
    })
    expect(invoice.state).to.be.eq(EInvoiceState.REQUESTED)
    expect(invoice.paidAt ?? null).to.be.null
    expect(invoice.settlementKind ?? null).to.be.null
    expect({
      escrowState: invoice.escrowState ?? null,
      escrowGrossBaseUnits: invoice.escrowGrossBaseUnits ?? null,
      escrowFeeBaseUnits: invoice.escrowFeeBaseUnits ?? null,
      escrowNetBaseUnits: invoice.escrowNetBaseUnits ?? null,
      escrowRefundedBaseUnits: invoice.escrowRefundedBaseUnits ?? null,
      escrowTxHash: invoice.escrowTxHash ?? null,
      escrowConfirmedAt: invoice.escrowConfirmedAt ?? null,
    }).to.deep.eq({
      escrowState: null,
      escrowGrossBaseUnits: null,
      escrowFeeBaseUnits: null,
      escrowNetBaseUnits: null,
      escrowRefundedBaseUnits: null,
      escrowTxHash: null,
      escrowConfirmedAt: null,
    })
    expect(invoice.escrowAllocationId).to.be.eq(bound.binding.allocationId)
    expect(invoice.escrowCommitment).to.be.eq(bound.commitment)
    expect(await this.hoursPaid(invoice)).to.deep.eq([false, false, false])

    const handMark = await this.statusOf(
      invoiceControllerMarkPaid({
        client: this.apiClient(),
        path: { id: bound.invoice.id as never },
        headers: this.auth(bound.worker),
        throwOnError: true,
      }),
    )

    expect(handMark).to.be.eq(409)

    const again = this.settlement(bound, EInvoiceEscrowState.RELEASED, {
      confirmedAt: 1788865260,
    })
    const repaid = await this.post(again)
    const after = await this.stored(bound.invoice.id)

    expect(repaid.data).to.include({ applied: true, state: EInvoiceState.PAID })
    expect(after.escrowTxHash).to.be.eq(again.txHash)
    expect(after.paidAt?.toISOString()).to.be.eq('2026-09-08T11:01:00.000Z')
    expect(await this.hoursPaid(after)).to.deep.eq([true, true, true])
  }

  /**
   * A reversal undoes only the settlement it names, once. Repeated, it
   * changes nothing. Late behind the settlement that replaced it - the same
   * release mined again in another transaction - it changes nothing. One
   * naming another bill changes nothing. A remainder refund taken back takes
   * back the release that followed it, which the same reorganisation
   * removed.
   */
  @test()
  async reversal_isIdempotentAndUndoesOnlyWhatItNames() {
    const bound = await this.bound()
    const release = this.settlement(bound, EInvoiceEscrowState.RELEASED)

    await this.post(release)

    const first = await this.postReversal(this.reversalOf(release))
    const repeated = await this.postReversal(this.reversalOf(release))
    const replacement = this.settlement(bound, EInvoiceEscrowState.RELEASED)

    await this.post(replacement)

    const late = await this.postReversal(this.reversalOf(release))
    const anotherBill = await this.postReversal(
      this.reversalOf(replacement, { grossBaseUnits: '1' }),
    )
    const kept = await this.stored(bound.invoice.id)

    expect(first.data.applied).to.be.true
    expect(repeated.status).to.be.eq(200)
    expect(repeated.data).to.include({ applied: false, escrowState: null })
    expect(late.status).to.be.eq(200)
    expect(late.data).to.include({
      applied: false,
      state: EInvoiceState.PAID,
      escrowState: EInvoiceEscrowState.RELEASED,
    })
    expect(anotherBill.data.applied).to.be.false
    expect(kept.state).to.be.eq(EInvoiceState.PAID)
    expect(kept.escrowTxHash).to.be.eq(replacement.txHash)
    expect(await this.hoursPaid(kept)).to.deep.eq([true, true, true])

    const other = await this.bound()
    const remainder = this.settlement(other, EInvoiceEscrowState.SUBMITTED, {
      refundedBaseUnits: '5000000',
    })

    await this.post(remainder)
    await this.post(
      this.settlement(other, EInvoiceEscrowState.RELEASED, {
        refundedBaseUnits: '5000000',
      }),
    )

    const followed = await this.postReversal(this.reversalOf(remainder))
    const reset = await this.stored(other.invoice.id)

    expect(followed.data).to.include({
      applied: true,
      state: EInvoiceState.REQUESTED,
    })
    expect(reset.escrowState ?? null).to.be.null
    expect(await this.hoursPaid(reset)).to.deep.eq([false, false, false])
  }

  /** A dispute refund taken back is no longer recorded as a refund. */
  @test()
  async reversal_ofADisputeRefund_clearsTheRefund() {
    const bound = await this.bound()
    const dispute = this.settlement(
      bound,
      EInvoiceEscrowState.DISPUTED_REFUNDED,
    )

    await this.post(dispute)

    const res = await this.postReversal(this.reversalOf(dispute))
    const invoice = await this.stored(bound.invoice.id)

    expect(res.data).to.deep.eq({
      applied: true,
      invoiceId: bound.invoice.id,
      state: EInvoiceState.REQUESTED,
      escrowState: null,
    })
    expect(invoice.escrowRefundedBaseUnits ?? null).to.be.null
    expect(invoice.settlementKind ?? null).to.be.null
    expect(invoice.escrowAllocationId).to.be.eq(bound.binding.allocationId)
  }

  /**
   * An invoice this instance does not know is a 409, as for the push; one
   * that records nothing of that allocation - never submitted, or submitted
   * elsewhere - has nothing to undo. Unsigned, forged, stale, replayed or
   * signed for the push, a reversal is a 401 and the release stands.
   */
  @test()
  async reversal_refusesWhatItCannotUndoAndAnythingUnsigned() {
    const bound = await this.bound()
    const release = this.settlement(bound, EInvoiceEscrowState.RELEASED)
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 20)
    const unbound = await this.invoiceFixture.createIssued(project, owner, 500)

    await this.post(release)

    const unknown = await this.postReversal(
      this.reversalOf(release, { invoiceId: randomUUID() }),
    )
    const neverSubmitted = await this.postReversal(
      this.reversalOf(release, { invoiceId: unbound.id }),
    )
    const elsewhere = await this.postReversal(
      this.reversalOf(release, { allocationId: this.bytes32() }),
    )
    const forged = await this.postReversal(this.reversalOf(release), 'deadbeef')
    const stale = await this.postReversal({
      ...this.reversalOf(release),
      issuedAt: Math.floor(Date.now() / 1000) - 3600,
    })
    const signed = this.reversalOf(release)
    const raw = JSON.stringify(signed)
    const once = this.signature.sign(InternalRoute.SETTLEMENT_REVERSAL, raw)

    const replayed = [
      await this.postReversal(signed, once),
      await this.postReversal(signed, once),
    ]
    const invoice = await this.stored(bound.invoice.id)

    expect(unknown.status).to.be.eq(409)
    expect(neverSubmitted.status).to.be.eq(200)
    expect(neverSubmitted.data.applied).to.be.false
    expect(elsewhere.status).to.be.eq(200)
    expect(elsewhere.data.applied).to.be.false
    expect(forged.status).to.be.eq(401)
    expect(stale.status).to.be.eq(401)
    expect(replayed.map((res) => res.status)).to.deep.eq([200, 401])

    // The one that got through reversed it; nothing else did.
    expect(invoice.state).to.be.eq(EInvoiceState.REQUESTED)

    await this.post(this.fresh(release))

    const pushSigned = this.fresh(this.reversalOf(release))
    const asPush = await this.postReversal(
      pushSigned,
      this.signature.sign(InternalRoute.SETTLEMENT, JSON.stringify(pushSigned)),
    )

    expect(asPush.status).to.be.eq(401)
    expect((await this.stored(bound.invoice.id)).state).to.be.eq(
      EInvoiceState.PAID,
    )
  }

  /** Internal like the push: served, and in neither the spec nor a client. */
  @test()
  async reversalRoute_isServedButLeftOutOfThePublicSpec() {
    const unsigned = await axios.post(
      `${this.url}/api/internal/marketplace/settlement-reversal`,
      this.reversalOf(this.fixture().body),
      { validateStatus: () => true },
    )
    const res = await helpControllerSwagger({
      client: this.apiClient(),
      throwOnError: true,
    })
    const spec = res.data as {
      paths: Record<string, unknown>
      components: { schemas: Record<string, unknown> }
    }

    expect(unsigned.status).to.be.eq(401)
    expect(spec.paths).to.not.have.property(
      '/api/internal/marketplace/settlement-reversal',
    )
    expect(spec.components.schemas).to.not.have.property(
      'MarketplaceSettlementReversalDto',
    )
  }
  /**
   * LAPSED-BINDING: an allocation that confirms an end without a bill -
   * expired unbilled, or cancelled before work - can never pay the invoice,
   * so the binding is released. Before that push a hand mark is a 409;
   * after it the invoice is still owed, is marked paid by hand, and leaves
   * escrow for good: a late repeat of the push records nothing on it.
   */
  @test()
  async lapse_releasesTheBinding_soTheInvoiceIsMarkedPaidByHand() {
    for (const state of [
      EInvoiceEscrowState.EXPIRED_REFUNDED,
      EInvoiceEscrowState.CANCELLED_REFUNDED,
    ]) {
      const bound = await this.bound()
      const before = await this.markByHand(bound, true)
      const push = this.lapse(bound, state)
      const lapsed = await this.post(push)
      const recorded = await this.stored(bound.invoice.id)
      const marked = await this.markByHand(bound, true)
      const paid = await this.stored(bound.invoice.id)
      const late = await this.post(this.fresh(push))
      const after = await this.stored(bound.invoice.id)

      expect(before, state).to.be.eq(409)
      expect(lapsed.data, state).to.deep.eq({
        applied: true,
        invoiceId: bound.invoice.id,
        state: EInvoiceState.REQUESTED,
        escrowState: state,
      })
      expect(recorded.state, state).to.be.eq(EInvoiceState.REQUESTED)
      expect(recorded.escrowState, state).to.be.eq(state)
      expect(recorded.escrowRefundedBaseUnits, state).to.be.eq('40000000')
      expect(marked, state).to.be.eq(200)
      expect(paid.state, state).to.be.eq(EInvoiceState.PAID)
      expect(paid.settlementKind, state).to.be.eq(EInvoiceSettlementKind.MANUAL)
      expect(paid.escrowAllocationId ?? null, state).to.be.null
      expect(paid.escrowCommitment ?? null, state).to.be.null
      expect(paid.escrowState ?? null, state).to.be.null
      expect(await this.hoursPaid(paid), state).to.deep.eq([true, true, true])
      expect(late.status, state).to.be.eq(200)
      expect(late.data.applied, state).to.be.false
      expect(after.state, state).to.be.eq(EInvoiceState.PAID)
      expect(after.settlementKind, state).to.be.eq(
        EInvoiceSettlementKind.MANUAL,
      )
    }
  }

  /**
   * A released binding may be taken up again for another allocation -
   * another period's that still covers the invoice - with a fresh
   * commitment, but never for the lapsed allocation, which takes no bill.
   * A lapse is not a refund of the invoice: it is still awaiting payment.
   */
  @test()
  async lapse_letsTheInvoiceBeBoundAfreshButNeverToTheLapsedAllocation() {
    const bound = await this.bound()
    const push = this.lapse(bound, EInvoiceEscrowState.CANCELLED_REFUNDED)

    await this.post(push)

    const same = await this.submitFor(bound, bound.request)
    const other = await this.submitFor(bound, {
      workStart: bound.request.workStart - 86400,
      workEnd: bound.request.workEnd,
    })
    const again = await this.submitFor(bound, {
      workStart: bound.request.workStart - 86400,
      workEnd: bound.request.workEnd,
    })
    const rebound = await this.stored(bound.invoice.id)
    const late = await this.post(this.fresh(push))
    const handMark = await this.markByHand(bound, true)

    expect(same.status).to.be.eq(409)
    expect(other.status, JSON.stringify(other.data)).to.be.eq(200)
    expect(other.data.allocationId).to.not.eq(bound.binding.allocationId)
    expect(other.data.invoiceCommitment).to.not.eq(bound.commitment)
    expect(again.data).to.deep.eq(other.data)
    expect(rebound.escrowAllocationId).to.be.eq(other.data.allocationId)
    expect(rebound.escrowCommitment).to.be.eq(other.data.invoiceCommitment)
    expect(rebound.escrowState ?? null).to.be.null
    expect(rebound.settlementKind ?? null).to.be.null
    expect(rebound.state).to.be.eq(EInvoiceState.REQUESTED)
    expect(late.status).to.be.eq(200)
    expect(late.data.applied).to.be.false
    expect((await this.stored(bound.invoice.id)).escrowAllocationId).to.be.eq(
      other.data.allocationId,
    )
    // Bound afresh, the new allocation settles it.
    expect(handMark).to.be.eq(409)
  }

  /**
   * A lapse a reorganisation took back puts the binding back in force: the
   * chain holds a funded allocation again, which may yet take the bill.
   */
  @test()
  async reversal_ofALapse_holdsTheBindingAgain() {
    const bound = await this.bound()
    const push = this.lapse(bound, EInvoiceEscrowState.EXPIRED_REFUNDED)

    await this.post(push)

    const res = await this.postReversal(this.reversalOf(push))
    const invoice = await this.stored(bound.invoice.id)

    expect(res.data).to.include({ applied: true, escrowState: null })
    expect(invoice.escrowAllocationId).to.be.eq(bound.binding.allocationId)
    expect(await this.markByHand(bound, true)).to.be.eq(409)
  }

  /**
   * ABANDONED-BINDING: the payee's browser asked for the commitment, which
   * bound the invoice, and never told the marketplace which invoice the
   * allocation bills. The marketplace asks once the allocation has a
   * settlement to push, and is told the invoice: the lapse it then pushes
   * releases the binding, so the invoice can be marked paid by hand -
   * without the answer it stayed bound to money that had gone back.
   */
  @test()
  async binding_answersTheInvoiceAnUnrecordedSubmissionBound() {
    const bound = await this.bound()
    const answer = await this.postBinding(this.bindingLookup(bound.binding))
    const before = await this.markByHand(bound, true)

    expect(answer.status).to.be.eq(200)
    expect(answer.data).to.deep.eq({ invoiceId: bound.invoice.id })
    expect(before).to.be.eq(409)

    const lapsed = await this.post(
      this.lapse(bound, EInvoiceEscrowState.EXPIRED_REFUNDED, {
        invoiceId: answer.data.invoiceId,
      }),
    )

    expect(lapsed.data.applied).to.be.true
    expect(await this.markByHand(bound, true)).to.be.eq(200)
    expect((await this.stored(bound.invoice.id)).state).to.be.eq(
      EInvoiceState.PAID,
    )

    // Marked by hand, it left escrow: the allocation binds nothing now.
    const after = await this.postBinding(this.bindingLookup(bound.binding))

    expect(after.data).to.deep.eq({ invoiceId: null })
  }

  /**
   * Casing is not identity: the lookup finds the binding whatever the case
   * of the escrow and id, as the push does. Nothing bound is null, and the
   * lookup is signed, fresh and single-use like every internal call.
   */
  @test()
  async binding_answersNullWhereNothingIsBoundAndRefusesAnythingUnsigned() {
    const bound = await this.bound()
    const upper = this.bindingLookup({
      chainId: bound.binding.chainId,
      escrow: `0x${bound.binding.escrow.slice(2).toUpperCase()}`,
      allocationId: `0x${bound.binding.allocationId.slice(2).toUpperCase()}`,
    })
    const cased = await this.postBinding(upper)
    const nothing = await this.postBinding(
      this.bindingLookup({ ...bound.binding, allocationId: this.bytes32() }),
    )
    const otherChain = await this.postBinding(
      this.bindingLookup({ ...bound.binding, chainId: 1 }),
    )
    const forged = await this.postBinding(
      this.bindingLookup(bound.binding),
      'deadbeef',
    )
    const stale = await this.postBinding({
      ...this.bindingLookup(bound.binding),
      issuedAt: Math.floor(Date.now() / 1000) - 3600,
    })
    const signed = this.bindingLookup(bound.binding)
    const once = this.signature.sign(
      InternalRoute.ESCROW_BINDING,
      JSON.stringify(signed),
    )
    const replayed = [
      await this.postBinding(signed, once),
      await this.postBinding(signed, once),
    ]
    const asPush = this.bindingLookup(bound.binding)
    const pushSigned = await this.postBinding(
      asPush,
      this.signature.sign(InternalRoute.SETTLEMENT, JSON.stringify(asPush)),
    )
    const malformed = await this.postBinding({
      ...this.bindingLookup(bound.binding),
      allocationId: 'not-an-allocation',
    })

    expect(cased.data).to.deep.eq({ invoiceId: bound.invoice.id })
    expect(nothing.status).to.be.eq(200)
    expect(nothing.data).to.deep.eq({ invoiceId: null })
    expect(otherChain.data).to.deep.eq({ invoiceId: null })
    expect(forged.status).to.be.eq(401)
    expect(stale.status).to.be.eq(401)
    expect(replayed.map((res) => res.status)).to.deep.eq([200, 401])
    expect(pushSigned.status).to.be.eq(401)
    expect(malformed.status).to.be.eq(400)
  }

  /** Internal like the push: served, and in neither the spec nor a client. */
  @test()
  async bindingRoute_isServedButLeftOutOfThePublicSpec() {
    const unsigned = await axios.post(
      `${this.url}/api/internal/marketplace/escrow-binding`,
      this.bindingLookup({
        chainId: 31337,
        escrow: '0x8bbc3514477d75ec797bbe4e19d7961660bb849c',
        allocationId: this.bytes32(),
      }),
      { validateStatus: () => true },
    )
    const res = await helpControllerSwagger({
      client: this.apiClient(),
      throwOnError: true,
    })
    const spec = res.data as {
      paths: Record<string, unknown>
      components: { schemas: Record<string, unknown> }
    }

    expect(unsigned.status).to.be.eq(401)
    expect(spec.paths).to.not.have.property(
      '/api/internal/marketplace/escrow-binding',
    )
    expect(spec.components.schemas).to.not.have.property(
      'MarketplaceEscrowBindingDto',
    )
  }
}
