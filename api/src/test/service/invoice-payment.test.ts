import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import moment from 'moment'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { EInvoiceState } from '@/model/invoice'
import { EProjectState } from '@/model/project'
import { InvoiceManager } from '@/service/invoice-manager'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeFixture } from '@/test/fixture/time-fixture'
import { TimeRepository } from '@/repository/time-repository'
import { UserFixture } from '@/test/fixture/user-fixture'

/**
 * Invoices own `Time.isPaid`. These assert the two records cannot drift: an
 * invoice is the only thing that says an hour has been paid for, and reverting
 * one has to put back exactly what marking it paid took.
 */
@suite()
export class InvoicePaymentTest extends AbstractDatabaseIntegration {
  protected userFixture: UserFixture
  protected projectFixture: ProjectFixture
  protected timeFixture: TimeFixture
  protected invoiceManager: InvoiceManager
  protected timeRepository: TimeRepository
  protected projectRepository: ProjectRepository

  constructor() {
    super()

    this.userFixture = this.container.get('UserFixture')
    this.projectFixture = this.container.get('ProjectFixture')
    this.timeFixture = this.container.get('TimeFixture')
    this.invoiceManager = this.container.get('InvoiceManager')
    this.timeRepository = this.container.get('TimeRepository')
    this.projectRepository = this.container.get('ProjectRepository')
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
    await this.projectRepository.saveSingle(project)

    const fromAt = moment.utc().subtract(3, 'hours')
    const toAt = moment.utc().subtract(1, 'hour')

    const workerTime = await this.timeFixture.create(
      project,
      fromAt.toDate(),
      fromAt.clone().add(1, 'hour').toDate(),
      worker,
    )
    workerTime.minutesActive = 60
    await this.timeRepository.saveSingle(workerTime)

    const ownerTime = await this.timeFixture.create(
      project,
      fromAt.clone().add(1, 'hour').toDate(),
      toAt.toDate(),
      owner,
    )
    ownerTime.minutesActive = 30
    await this.timeRepository.saveSingle(ownerTime)

    const invoice = await this.invoiceManager.create(
      { fromUnix: fromAt.valueOf(), toUnix: toAt.valueOf() },
      project,
      worker,
    )

    return { owner, worker, project, invoice, workerTime, ownerTime }
  }

  @test()
  async markPaid_marksTheCoveredTimePaid() {
    const { worker, invoice, workerTime } = await this.scenario()

    const paid = await this.invoiceManager.markPaid(invoice, worker)

    expect(paid.state).to.be.equal(EInvoiceState.PAID)
    expect(paid.paidAt).to.not.be.null

    const reloaded = await this.timeRepository.findOneByIdOrFail(workerTime.id)
    expect(reloaded.isPaid).to.be.true
  }

  /** One person's invoice must not settle a colleague's hours. */
  @test()
  async markPaid_leavesAnotherContributorsTimeAlone() {
    const { worker, invoice, ownerTime } = await this.scenario()

    await this.invoiceManager.markPaid(invoice, worker)

    const reloaded = await this.timeRepository.findOneByIdOrFail(ownerTime.id)
    expect(reloaded.isPaid).to.not.be.true
  }

  @test()
  async markUnpaid_releasesTheTimeBack() {
    const { worker, invoice, workerTime } = await this.scenario()

    await this.invoiceManager.markPaid(invoice, worker)
    const reverted = await this.invoiceManager.markUnpaid(invoice, worker)

    expect(reverted.state).to.be.equal(EInvoiceState.REQUESTED)
    expect(reverted.paidAt ?? null).to.be.null

    const reloaded = await this.timeRepository.findOneByIdOrFail(workerTime.id)
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
      await this.invoiceManager.markPaid(invoice, owner)
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

    await this.invoiceManager.markPaid(invoice, worker)

    let error: Error | undefined

    try {
      await this.invoiceManager.create(
        { fromUnix: fromAt.valueOf(), toUnix: toAt.valueOf() },
        project,
        worker,
      )
    } catch (e: unknown) {
      error = e as Error
    }

    expect(error?.message).to.contain('no unpaid tracked time')
  }
}
