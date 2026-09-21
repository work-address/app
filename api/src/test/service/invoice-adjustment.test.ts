import { randomUUID } from 'crypto'
import axios from 'axios'
import moment from 'moment'
import { expect } from 'chai'
import { suite, test, timeout } from '@testdeck/mocha'
import {
  invoiceControllerCreate,
  invoiceControllerEscrowSubmission,
  invoiceControllerRecord,
} from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { Invoice } from '@/entity/invoice'
import { Project } from '@/entity/project'
import { Time } from '@/entity/time'
import { User } from '@/entity/user'
import {
  EInvoiceEscrowState,
  EInvoiceState,
  IInvoiceCommitmentBinding,
} from '@/model/invoice'
import { EProjectState } from '@/model/project'
import { MarketplaceHireController } from '@/controller/marketplace-hire-controller'
import { MarketplaceSettlementController } from '@/controller/marketplace-settlement-controller'
import { EntitlementSignature } from '@/service/entitlement-signature'
import { InternalRoute } from '@/service/internal-route'
import { InvoiceEscrow } from '@/service/invoice-escrow'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeRepository } from '@/repository/time-repository'
import { runPromise } from '@/service/effect-bridge'

type Hired = { client: User; worker: User; project: Project }

type Response = { status: number; data: Record<string, unknown> }

type Allocation = IInvoiceCommitmentBinding & {
  workStart: number
  workEnd: number
}

/**
 * DEC-04, WP-100: a correction is an adjustment invoice, never an edit.
 *
 * The snapshot is taken at issuance and an entry an invoice bills cannot be
 * deleted, so the only way to bill what an invoice missed is a new invoice
 * that names the one it corrects. These tests pin the two cases the policy
 * exists for - the final bill after a contract ends, and late work after a
 * refund - with the original compared column for column before and after,
 * and the rules around them: it bills only what no invoice covers, only the
 * issuer may raise it, and it cannot take an allocation that has settled.
 *
 * Every test declares a 20s budget: each chains a dozen HTTP calls (issue,
 * submit, settle, adjust, read back), which is well under mocha's 2s default
 * on an idle machine and over it when other suites share the machine. A
 * budget only ever makes a test less likely to fail.
 */
@suite()
export class InvoiceAdjustmentTest extends BaseControllerTest {
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

  private auth(user: User) {
    return { Authorization: this.authenticator.getTokens(user).accessToken }
  }

  /** One clock read for the whole test; every bound derives from it. */
  private readonly start = moment.utc().startOf('minute').subtract(10, 'hours')

  private async hired(rateHour = 20): Promise<Hired> {
    const client = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createHired(
      client,
      worker,
      rateHour,
    )

    return { client, worker, project }
  }

  /** A half-hour entry of the worker's, `offset` half-hours after the start. */
  private async entry(hired: Hired, offset: number): Promise<Time> {
    const from = this.start.clone().add(offset * 30, 'minutes')
    const time = await this.timeFixture.create(
      hired.project,
      from.toDate(),
      from.clone().add(30, 'minutes').toDate(),
      hired.worker,
    )

    time.minutesActive = 30
    await runPromise(this.timeRepository.saveSingle(time))

    return time
  }

  private async invoiceEverything(hired: Hired): Promise<string> {
    const created = await invoiceControllerCreate({
      client: this.apiClient(),
      path: { projectId: hired.project.id as never },
      headers: this.auth(hired.worker),
      body: {},
      throwOnError: true,
    })

    return created.data.id as string
  }

  private adjust(
    invoiceId: string,
    user: User,
    body: Record<string, unknown> = {},
  ): Promise<Response> {
    return axios.post(`${this.url}/api/invoice/${invoiceId}/adjustment`, body, {
      headers: this.auth(user),
      validateStatus: () => true,
    })
  }

  /**
   * The original's row as stored - every column of its own, `updatedAt`
   * included, with the eager relations reduced to the ids it holds (the
   * project itself legitimately changes when the contract ends) - and the
   * entries it bills.
   */
  private async snapshotOf(invoiceId: string) {
    const stored = await runPromise(
      this.invoiceRepository.findOneBy({ where: { id: invoiceId } }),
    )
    const { project, user, ...columns } = stored as Invoice
    const times = await runPromise(
      this.timeRepository.findForInvoice({ id: invoiceId } as Invoice),
    )

    return {
      invoice: {
        ...structuredClone(columns),
        projectId: project?.id,
        userId: user?.id,
      },
      times: times
        .map((time) => ({ id: time.id, isPaid: Boolean(time.isPaid) }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    }
  }

  private async linesOf(invoiceId: string): Promise<string[]> {
    const times = await runPromise(
      this.timeRepository.findForInvoice({ id: invoiceId } as Invoice),
    )

    return times.map((time) => time.id).sort()
  }

  /** The marketplace ending the contract, as its signed call does. */
  private async endContract(project: Project): Promise<void> {
    const body = {
      contractId: project.marketplaceContractId,
      issuedAt: Math.floor(Date.now() / 1000),
      nonce: randomUUID(),
    }
    const raw = JSON.stringify(body)
    const ended = await axios.post(
      `${this.url}/api/internal/marketplace/end`,
      raw,
      {
        headers: {
          'Content-Type': 'application/json',
          [MarketplaceHireController.END_SIGNATURE_HEADER]: this.signature.sign(
            InternalRoute.END,
            raw,
          ),
        },
        validateStatus: () => true,
      },
    )

    expect(ended.status, JSON.stringify(ended.data)).to.be.eq(200)
  }

  /** The allocation funding the contract's work around the start. */
  private binding(project: Project): Allocation {
    const request = {
      chainId: 31337,
      escrow: '0x8bbc3514477d75ec797bbe4e19d7961660bb849c',
      workStart: this.start.clone().subtract(1, 'day').unix(),
      workEnd: this.start.clone().add(1, 'day').unix(),
    }

    return {
      ...request,
      allocationId: InvoiceEscrow.contractPeriodAllocationId(
        project.marketplaceContractId!,
        { ...request, allocationId: '' },
      ),
    }
  }

  private submit(invoiceId: string, worker: User, query: Allocation) {
    return invoiceControllerEscrowSubmission({
      client: this.apiClient(),
      path: { id: invoiceId as never },
      query,
      headers: this.auth(worker),
      throwOnError: true,
    })
  }

  /** The escrow indexer reporting how the allocation settled. */
  private async settle(
    invoiceId: string,
    binding: IInvoiceCommitmentBinding,
    commitment: string,
    amountBaseUnits: string,
    state: EInvoiceEscrowState,
  ): Promise<void> {
    const gross = BigInt(amountBaseUnits)
    const fee = (gross * BigInt(500)) / BigInt(10000)
    const released = state === EInvoiceEscrowState.RELEASED
    const body = {
      invoiceId,
      chainId: binding.chainId,
      escrow: binding.escrow,
      allocationId: binding.allocationId,
      invoiceCommitment: commitment,
      escrowState: state,
      grossBaseUnits: gross.toString(),
      feeBaseUnits: released ? fee.toString() : '0',
      netBaseUnits: released ? (gross - fee).toString() : '0',
      refundedBaseUnits: released ? '0' : gross.toString(),
      txHash: `0x${'ab'.repeat(32)}`,
      confirmedAt: 1788865200,
      issuedAt: Math.floor(Date.now() / 1000),
      nonce: randomUUID(),
    }
    const raw = JSON.stringify(body)
    const pushed = await axios.post(
      `${this.url}/api/internal/marketplace/settlement`,
      raw,
      {
        headers: {
          'Content-Type': 'application/json',
          [MarketplaceSettlementController.SIGNATURE_HEADER]:
            this.signature.sign(InternalRoute.SETTLEMENT, raw),
        },
        validateStatus: () => true,
      },
    )

    expect(pushed.status, JSON.stringify(pushed.data)).to.be.eq(200)
  }

  private async escrowStatus(call: Promise<unknown>): Promise<number> {
    try {
      await call
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        return error.response.status
      }

      throw error
    }

    return 200
  }

  /**
   * Acceptance: a final adjustment after termination. The worker invoiced
   * the morning, tracked the afternoon, and then the contract ended - which
   * closes the project to new time but not to billing what was tracked. The
   * adjustment bills the afternoon and only the afternoon, names the invoice
   * it corrects, and the original is exactly as it was.
   */
  @test()
  @timeout(20000)
  async finalAdjustmentAfterTermination_billsTheRestAndLeavesTheOriginal() {
    const hired = await this.hired(20)
    const morning = [await this.entry(hired, 0), await this.entry(hired, 1)]
    const originalId = await this.invoiceEverything(hired)
    const afternoon = [await this.entry(hired, 4), await this.entry(hired, 5)]
    const before = await this.snapshotOf(originalId)

    await this.endContract(hired.project)

    const project = await runPromise(
      this.projectRepository.findOneBy({ where: { id: hired.project.id } }),
    )

    expect(project?.state).to.be.eq(EProjectState.INACTIVE)

    const adjusted = await this.adjust(originalId, hired.worker)

    expect(adjusted.status, JSON.stringify(adjusted.data)).to.be.eq(201)
    expect(adjusted.data.correctsInvoiceId).to.be.eq(originalId)
    expect(adjusted.data.id).to.not.eq(originalId)
    // Two half-hours of 30 active minutes at $20/h.
    expect(Number(adjusted.data.amountCents)).to.be.eq(2000)
    expect(await this.linesOf(adjusted.data.id as string)).to.deep.eq(
      afternoon.map((time) => time.id).sort(),
    )

    // The original: every column, and the entries it bills.
    expect(await this.snapshotOf(originalId)).to.deep.eq(before)
    expect(await this.linesOf(originalId)).to.deep.eq(
      morning.map((time) => time.id).sort(),
    )

    // A correction commits to what it corrects.
    const record = await invoiceControllerRecord({
      client: this.apiClient(),
      path: { id: adjusted.data.id as never },
      headers: this.auth(hired.worker),
      throwOnError: true,
    })

    expect(record.data.correctsInvoiceId).to.be.eq(originalId)

    // Nothing is left, so a second adjustment has nothing to bill.
    const again = await this.adjust(originalId, hired.worker)

    expect(again.status).to.be.eq(400)
    expect(await this.snapshotOf(originalId)).to.deep.eq(before)
  }

  /**
   * Acceptance: late work after a refund. The original was billed through
   * escrow and the client's dispute refunded it. Hours logged afterwards are
   * billed by an adjustment, which leaves the refunded original - its state,
   * its escrow record, its unpaid hours - exactly as it was, and cannot be
   * sent to the allocation that settled it.
   */
  @test()
  @timeout(20000)
  async lateWorkAfterARefund_isBilledByAnAdjustmentThatCannotTakeTheSettledAllocation() {
    const hired = await this.hired(20)
    const billed = [await this.entry(hired, 0), await this.entry(hired, 1)]
    const originalId = await this.invoiceEverything(hired)
    const binding = this.binding(hired.project)
    const submission = await this.submit(originalId, hired.worker, binding)

    await this.settle(
      originalId,
      binding,
      submission.data.invoiceCommitment,
      submission.data.amountBaseUnits,
      EInvoiceEscrowState.DISPUTED_REFUNDED,
    )

    const late = [await this.entry(hired, 3)]
    const before = await this.snapshotOf(originalId)

    expect(before.invoice.state).to.be.eq(EInvoiceState.REQUESTED)
    expect(before.invoice.escrowState).to.be.eq(
      EInvoiceEscrowState.DISPUTED_REFUNDED,
    )

    const adjusted = await this.adjust(originalId, hired.worker)

    expect(adjusted.status, JSON.stringify(adjusted.data)).to.be.eq(201)
    expect(adjusted.data.correctsInvoiceId).to.be.eq(originalId)
    expect(Number(adjusted.data.amountCents)).to.be.eq(1000)
    expect(await this.linesOf(adjusted.data.id as string)).to.deep.eq(
      late.map((time) => time.id),
    )
    // The refunded hours stay the original's, unpaid: the adjustment is for
    // new work, not a second bill for what the client disputed.
    expect(await this.linesOf(originalId)).to.deep.eq(
      billed.map((time) => time.id).sort(),
    )
    expect(await this.snapshotOf(originalId)).to.deep.eq(before)

    // The settled allocation takes no second bill.
    const status = await this.escrowStatus(
      this.submit(adjusted.data.id as string, hired.worker, binding),
    )

    expect(status).to.be.eq(409)
    expect(await this.snapshotOf(originalId)).to.deep.eq(before)
  }

  /** The same holds for an allocation that released: it paid its bill. */
  @test()
  @timeout(20000)
  async adjustment_cannotTakeTheAllocationThatPaidTheOriginal() {
    const hired = await this.hired(20)

    await this.entry(hired, 0)
    const originalId = await this.invoiceEverything(hired)
    const binding = this.binding(hired.project)
    const submission = await this.submit(originalId, hired.worker, binding)

    await this.settle(
      originalId,
      binding,
      submission.data.invoiceCommitment,
      submission.data.amountBaseUnits,
      EInvoiceEscrowState.RELEASED,
    )

    await this.entry(hired, 2)
    const before = await this.snapshotOf(originalId)

    expect(before.invoice.state).to.be.eq(EInvoiceState.PAID)

    const adjusted = await this.adjust(originalId, hired.worker)

    expect(adjusted.status).to.be.eq(201)

    const status = await this.escrowStatus(
      this.submit(adjusted.data.id as string, hired.worker, binding),
    )

    expect(status).to.be.eq(409)
    expect(await this.snapshotOf(originalId)).to.deep.eq(before)
  }

  /**
   * A selection bills exactly the entries named - each of which must still
   * be unbilled: one the original already bills is refused, whole.
   */
  @test()
  @timeout(20000)
  async selection_billsExactlyTheNamedEntries_andNeverAnotherInvoicesEntry() {
    const hired = await this.hired(20)
    const billed = await this.entry(hired, 0)
    const originalId = await this.invoiceEverything(hired)
    const lateOne = await this.entry(hired, 2)
    const lateTwo = await this.entry(hired, 3)
    const before = await this.snapshotOf(originalId)

    const stolen = await this.adjust(originalId, hired.worker, {
      timeIds: [lateOne.id, billed.id],
    })

    expect(stolen.status).to.be.eq(400)
    expect(await this.snapshotOf(originalId)).to.deep.eq(before)

    const picked = await this.adjust(originalId, hired.worker, {
      timeIds: [lateTwo.id],
    })

    expect(picked.status).to.be.eq(201)
    expect(await this.linesOf(picked.data.id as string)).to.deep.eq([
      lateTwo.id,
    ])

    const empty = await this.adjust(originalId, hired.worker, { timeIds: [] })

    expect(empty.status).to.be.eq(400)
  }

  /**
   * Only the issuer corrects their invoice. The client billed reads it but
   * cannot raise a bill against themselves; a stranger cannot read it; an
   * unknown id is a 404. None of them changes anything.
   */
  @test()
  @timeout(20000)
  async adjustment_isTheIssuersAlone() {
    const hired = await this.hired(20)

    await this.entry(hired, 0)
    const originalId = await this.invoiceEverything(hired)

    await this.entry(hired, 2)
    const before = await this.snapshotOf(originalId)
    const stranger = await this.userFixture.createUser()

    expect((await this.adjust(originalId, hired.client)).status).to.be.eq(403)
    expect((await this.adjust(originalId, stranger)).status).to.be.eq(403)
    expect((await this.adjust(randomUUID(), hired.worker)).status).to.be.eq(404)
    expect(await this.snapshotOf(originalId)).to.deep.eq(before)
  }

  /**
   * An invoice bills hours or an agreed sum, never both (SPEC.md). A FIXED
   * invoice has no hours on it, so "the hours it missed" means nothing: an
   * hourly bill naming it would present tracked time as a correction to a
   * sum the parties agreed, and only the marketplace's signed call can agree
   * another. Refused with a 409 that bills nothing - the entry stays free
   * for an ordinary invoice, and the milestone invoice stays as it was.
   */
  @test()
  @timeout(20000)
  async fixedInvoice_isNotCorrectedByHours() {
    const hired = await this.hired(20)
    const body = {
      contractId: hired.project.marketplaceContractId,
      milestoneRef: randomUUID(),
      freelancerId: hired.worker.id,
      amountCents: 250000,
      description: 'Milestone 1: the import, delivered and accepted',
      workStart: this.start.clone().subtract(7, 'days').unix(),
      workEnd: this.start.unix(),
      issuedAt: Math.floor(Date.now() / 1000),
      nonce: randomUUID(),
    }
    const raw = JSON.stringify(body)
    const pushed = await axios.post(
      `${this.url}/api/internal/marketplace/milestone-invoice`,
      raw,
      {
        headers: {
          'Content-Type': 'application/json',
          [MarketplaceHireController.MILESTONE_SIGNATURE_HEADER]:
            this.signature.sign(InternalRoute.MILESTONE_INVOICE, raw),
        },
        validateStatus: () => true,
      },
    )

    expect(pushed.status, JSON.stringify(pushed.data)).to.be.eq(200)

    const fixedId = pushed.data.invoiceId as string
    const tracked = await this.entry(hired, 0)
    const before = await this.snapshotOf(fixedId)

    const refused = await this.adjust(fixedId, hired.worker)
    const selected = await this.adjust(fixedId, hired.worker, {
      timeIds: [tracked.id],
    })

    expect(refused.status, JSON.stringify(refused.data)).to.be.eq(409)
    expect(selected.status, JSON.stringify(selected.data)).to.be.eq(409)
    expect(await this.snapshotOf(fixedId)).to.deep.eq(before)

    const invoices = await this.invoiceRepository
      .getRepo()
      .count({ where: { project: { id: hired.project.id } } })

    expect(invoices).to.be.eq(1)

    // Nothing claimed the entry: an ordinary invoice still bills it.
    const ordinaryId = await this.invoiceEverything(hired)

    expect(await this.linesOf(ordinaryId)).to.deep.eq([tracked.id])
  }

  /**
   * DEC-04's other half, which is what makes an adjustment the only way: an
   * entry an invoice bills cannot be deleted (409), so the original's lines
   * stay what it billed.
   */
  @test()
  @timeout(20000)
  async invoicedEntry_cannotBeDeleted() {
    const hired = await this.hired(20)
    const billed = await this.entry(hired, 0)
    const originalId = await this.invoiceEverything(hired)
    const before = await this.snapshotOf(originalId)

    const deleted = await axios.delete(`${this.url}/api/time`, {
      data: { ids: [billed.id] },
      headers: this.auth(hired.worker),
      validateStatus: () => true,
    })

    expect(deleted.status).to.be.eq(409)
    expect(await this.snapshotOf(originalId)).to.deep.eq(before)
  }
}
