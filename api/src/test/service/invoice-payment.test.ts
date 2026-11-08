import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import moment from 'moment'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { EInvoiceState } from '@/model/invoice'
import { EProjectState } from '@/model/project'
import { InvoiceManager } from '@/service/invoice-manager'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { Time } from '@/entity/time'
import { TimeManager } from '@/service/time-manager'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeFixture } from '@/test/fixture/time-fixture'
import { TimeRepository } from '@/repository/time-repository'
import { UserFixture } from '@/test/fixture/user-fixture'
import { runPromise } from '@/service/effect-bridge'

/**
 * An invoice's actions write `Time.isPaid` over everything on it, and its author
 * may change an entry by hand afterwards without touching the invoice. Reverting
 * an invoice has to put back what marking it paid took; un-marking an entry must
 * never let it be billed twice.
 */
@suite()
export class InvoicePaymentTest extends AbstractDatabaseIntegration {
  protected userFixture: UserFixture
  protected projectFixture: ProjectFixture
  protected timeFixture: TimeFixture
  protected invoiceManager: InvoiceManager
  protected invoiceRepository: InvoiceRepository
  protected timeRepository: TimeRepository
  protected projectRepository: ProjectRepository

  constructor() {
    super()

    this.userFixture = this.container.get('UserFixture')
    this.projectFixture = this.container.get('ProjectFixture')
    this.timeFixture = this.container.get('TimeFixture')
    this.invoiceManager = this.container.get('InvoiceManager')
    this.invoiceRepository = this.container.get('InvoiceRepository')
    this.timeRepository = this.container.get('TimeRepository')
    this.projectRepository = this.container.get('ProjectRepository')
  }

  private isPaid(id: string) {
    return runPromise(this.timeRepository.findOneByIdOrFail(id)).then(
      (time) => time.isPaid,
    )
  }

  @test()
  async anAuthorChangesAnInvoicedEntryByHandInBothDirections() {
    const { worker, workerTime } = await this.scenario()
    const timeManager = this.container.get<TimeManager>('TimeManager')

    await runPromise(timeManager.setIsPaidMany([workerTime.id], true, worker))
    expect(await this.isPaid(workerTime.id)).to.be.true

    await runPromise(timeManager.setIsPaidMany([workerTime.id], false, worker))
    expect(await this.isPaid(workerTime.id)).to.be.false

    await runPromise(
      timeManager.edit(
        workerTime.id,
        Object.assign(new Time(), { isPaid: true }),
        worker,
      ),
    )
    expect(await this.isPaid(workerTime.id)).to.be.true
  }

  @test()
  async aHandChangeNeverChangesTheInvoice() {
    const { worker, invoice, workerTime } = await this.scenario()
    const timeManager = this.container.get<TimeManager>('TimeManager')

    // Every entry on the invoice is now marked paid; it stays requested.
    await runPromise(timeManager.setIsPaidMany([workerTime.id], true, worker))
    const requested = await runPromise(
      this.invoiceRepository.findOneByIdOrFail(invoice.id),
    )
    expect(requested.state).to.be.equal(EInvoiceState.REQUESTED)
    expect(requested.paidAt ?? null).to.be.null

    await runPromise(this.invoiceManager.markPaid(invoice, worker))
    await runPromise(timeManager.setIsPaidMany([workerTime.id], false, worker))
    const paid = await runPromise(
      this.invoiceRepository.findOneByIdOrFail(invoice.id),
    )
    expect(paid.state).to.be.equal(EInvoiceState.PAID)
    expect(paid.paidAt).to.not.be.null
  }

  /** The last action wins, whichever record it came from. */
  @test()
  async anInvoiceActionOverwritesHandMarks() {
    const { worker, invoice, workerTime } = await this.scenario()
    const timeManager = this.container.get<TimeManager>('TimeManager')

    await runPromise(timeManager.setIsPaidMany([workerTime.id], true, worker))
    await runPromise(this.invoiceManager.markPaid(invoice, worker))
    expect(await this.isPaid(workerTime.id)).to.be.true

    await runPromise(timeManager.setIsPaidMany([workerTime.id], false, worker))
    expect(await this.isPaid(workerTime.id)).to.be.false

    await runPromise(timeManager.setIsPaidMany([workerTime.id], true, worker))
    await runPromise(this.invoiceManager.markUnpaid(invoice, worker))
    expect(await this.isPaid(workerTime.id)).to.be.false
  }

  @test()
  async rejectingOverwritesAHandMark() {
    const { owner, worker, invoice, workerTime } = await this.scenario()
    const timeManager = this.container.get<TimeManager>('TimeManager')

    await runPromise(timeManager.setIsPaidMany([workerTime.id], true, worker))
    await runPromise(this.invoiceManager.reject(invoice, owner, 'wrong hours'))

    expect(await this.isPaid(workerTime.id)).to.be.false
  }

  /** The invoice link, not the paid flag, is what stops a second bill. */
  @test()
  async unMarkingAnInvoicedEntryCannotBillItAgain() {
    const { worker, project, invoice, workerTime } = await this.scenario()
    const timeManager = this.container.get<TimeManager>('TimeManager')
    const fromAt = moment.utc().subtract(3, 'hours')
    const toAt = moment.utc().subtract(1, 'hour')

    await runPromise(this.invoiceManager.markPaid(invoice, worker))
    await runPromise(timeManager.setIsPaidMany([workerTime.id], false, worker))

    const message = async (issue: () => Promise<unknown>) => {
      try {
        await issue()
      } catch (e: unknown) {
        return (e as Error).message
      }
      return undefined
    }

    expect(
      await message(() =>
        runPromise(
          this.invoiceManager.create(
            { fromUnix: fromAt.valueOf(), toUnix: toAt.valueOf() },
            project,
            worker,
          ),
        ),
      ),
    ).to.contain('no unpaid tracked time')
    expect(
      await message(() =>
        runPromise(
          this.invoiceManager.createFromTimeIds(project, worker, [
            workerTime.id,
          ]),
        ),
      ),
    ).to.be.a('string')

    const billing = await runPromise(
      this.invoiceManager.ensureForProject(project, worker),
    )
    expect(billing?.id).to.be.equal(invoice.id)
  }

  private async scenario() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    project.rateHour = 60
    await runPromise(this.projectRepository.saveSingle(project))

    const fromAt = moment.utc().subtract(3, 'hours')
    const toAt = moment.utc().subtract(1, 'hour')

    const workerTime = await this.timeFixture.create(
      project,
      fromAt.toDate(),
      fromAt.clone().add(1, 'hour').toDate(),
      worker,
    )
    workerTime.minutesActive = 60
    await runPromise(this.timeRepository.saveSingle(workerTime))

    const ownerTime = await this.timeFixture.create(
      project,
      fromAt.clone().add(1, 'hour').toDate(),
      toAt.toDate(),
      owner,
    )
    ownerTime.minutesActive = 30
    await runPromise(this.timeRepository.saveSingle(ownerTime))

    const invoice = await runPromise(
      this.invoiceManager.create(
        { fromUnix: fromAt.valueOf(), toUnix: toAt.valueOf() },
        project,
        worker,
      ),
    )

    return { owner, worker, project, invoice, workerTime, ownerTime }
  }

  @test()
  async markPaid_marksTheCoveredTimePaid() {
    const { worker, invoice, workerTime } = await this.scenario()

    const paid = await runPromise(this.invoiceManager.markPaid(invoice, worker))

    expect(paid.state).to.be.equal(EInvoiceState.PAID)
    expect(paid.paidAt).to.not.be.null

    const reloaded = await runPromise(
      this.timeRepository.findOneByIdOrFail(workerTime.id),
    )
    expect(reloaded.isPaid).to.be.true
  }

  /** One person's invoice must not settle a colleague's hours. */
  @test()
  async markPaid_leavesAnotherContributorsTimeAlone() {
    const { worker, invoice, ownerTime } = await this.scenario()

    await runPromise(this.invoiceManager.markPaid(invoice, worker))

    const reloaded = await runPromise(
      this.timeRepository.findOneByIdOrFail(ownerTime.id),
    )
    expect(reloaded.isPaid).to.not.be.true
  }

  @test()
  async markUnpaid_releasesTheTimeBack() {
    const { worker, invoice, workerTime } = await this.scenario()

    await runPromise(this.invoiceManager.markPaid(invoice, worker))
    const reverted = await runPromise(
      this.invoiceManager.markUnpaid(invoice, worker),
    )

    expect(reverted.state).to.be.equal(EInvoiceState.REQUESTED)
    expect(reverted.paidAt ?? null).to.be.null

    const reloaded = await runPromise(
      this.timeRepository.findOneByIdOrFail(workerTime.id),
    )
    expect(reloaded.isPaid).to.be.false
  }

  /**
   * The person owed the money is the one who knows whether it arrived. Letting
   * the payer self-certify would make the record worth less than the wallet
   * history it summarises.
   */
  @test()
  async markPaid_isRefusedForAnyoneButTheIssuer() {
    const { owner, invoice } = await this.scenario()

    let error: Error | undefined

    try {
      await runPromise(this.invoiceManager.markPaid(invoice, owner))
    } catch (e: unknown) {
      error = e as Error
    }

    expect(error?.message).to.contain('issued an invoice')
  }

  /** Already-paid time is excluded, so the same hours cannot be billed twice. */
  @test()
  async create_afterPayment_cannotRebillTheSameHours() {
    const { worker, project, invoice } = await this.scenario()
    const fromAt = moment.utc().subtract(3, 'hours')
    const toAt = moment.utc().subtract(1, 'hour')

    await runPromise(this.invoiceManager.markPaid(invoice, worker))

    let error: Error | undefined

    try {
      await runPromise(
        this.invoiceManager.create(
          { fromUnix: fromAt.valueOf(), toUnix: toAt.valueOf() },
          project,
          worker,
        ),
      )
    } catch (e: unknown) {
      error = e as Error
    }

    expect(error?.message).to.contain('no unpaid tracked time')
  }
}
