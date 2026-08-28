import { expect } from 'chai'
import moment from 'moment'
import { suite, test } from '@testdeck/mocha'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { InvoiceManager } from '@/service/invoice-manager'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeFixture } from '@/test/fixture/time-fixture'
import { TimeRepository } from '@/repository/time-repository'
import AccessException from '@/exception/access-exception'
import { EProjectState } from '@/model/project'

@suite()
export class InvoiceManagerTest extends AbstractDatabaseIntegration {
  protected invoiceManager: InvoiceManager
  protected projectFixture: ProjectFixture
  protected projectRepository: ProjectRepository
  protected timeFixture: TimeFixture
  protected timeRepository: TimeRepository

  constructor() {
    super()
    this.invoiceManager = this.container.get('InvoiceManager')
    this.projectFixture = this.container.get('ProjectFixture')
    this.projectRepository = this.container.get('ProjectRepository')
    this.timeFixture = this.container.get('TimeFixture')
    this.timeRepository = this.container.get('TimeRepository')
  }

  @test()
  /**
   * Each person invoices their own hours. Previously one invoice summed every
   * contributor's time on the project, which meant an owner billed for a
   * worker's hours in a record that named nobody - and the worker had no way
   * to raise their own.
   */
  async create_scopesToTheIssuersOwnTimeOnly() {
    // Premium: collaborator access is gated on the owner's plan, so a worker
    // on a free project has no access to invoice against in the first place.
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    project.workerAddresses = [worker.address]
    await this.projectRepository.saveSingle(project)

    const fromAt = moment.utc().subtract(3, 'hours')
    const toAt = moment.utc().subtract(1, 'hour')

    const ownerTime = await this.timeFixture.create(
      project,
      fromAt.toDate(),
      fromAt.clone().add(1, 'hour').toDate(),
      owner,
    )
    ownerTime.minutesActive = 60
    await this.timeRepository.saveSingle(ownerTime)

    const workerTime = await this.timeFixture.create(
      project,
      fromAt.clone().add(1, 'hour').toDate(),
      toAt.toDate(),
      worker,
    )
    workerTime.minutesActive = 30
    await this.timeRepository.saveSingle(workerTime)

    const ownerInvoice = await this.invoiceManager.create(
      { fromUnix: fromAt.valueOf(), toUnix: toAt.valueOf() },
      project,
      owner,
    )

    // 60 minutes at $60/hour = 6000 cents. The worker's 30 minutes are not
    // the owner's to bill for.
    expect(ownerInvoice.amountCents).to.equal(6000)
    expect(ownerInvoice.user?.id).to.equal(owner.id)

    const workerInvoice = await this.invoiceManager.create(
      { fromUnix: fromAt.valueOf(), toUnix: toAt.valueOf() },
      project,
      worker,
    )

    expect(workerInvoice.amountCents).to.equal(3000)
    expect(workerInvoice.user?.id).to.equal(worker.id)
  }

  @test()
  async create_excludesPaidTimeInRange() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)

    const fromAt = moment.utc().subtract(3, 'hours')
    const toAt = moment.utc().subtract(1, 'hour')

    const unpaidTime = await this.timeFixture.create(
      project,
      fromAt.toDate(),
      fromAt.clone().add(1, 'hour').toDate(),
      owner,
    )
    unpaidTime.minutesActive = 60
    await this.timeRepository.saveSingle(unpaidTime)

    const paidTime = await this.timeFixture.create(
      project,
      fromAt.clone().add(1, 'hour').toDate(),
      toAt.toDate(),
      owner,
    )
    paidTime.minutesActive = 120
    paidTime.isPaid = true
    await this.timeRepository.saveSingle(paidTime)

    const invoice = await this.invoiceManager.create(
      {
        fromUnix: fromAt.valueOf(),
        toUnix: toAt.valueOf(),
      },
      project,
      owner,
    )

    expect(invoice.amountCents).to.equal(6000)
  }

  @test()
  /**
   * The gate is the owner's plan, not the caller's role. A worker on a premium
   * owner's project invoices their own hours; a worker on a free one has no
   * collaborator access at all, so there is nothing for them to bill against.
   */
  async create_throwsAccessExceptionForWorkerOnAFreeOwnersProject() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    await this.projectRepository.saveSingle(project)

    let error: unknown

    try {
      await this.invoiceManager.create(
        {
          fromUnix: moment.utc().subtract(1, 'day').valueOf(),
          toUnix: moment.utc().valueOf(),
        },
        project,
        worker,
      )
    } catch (e: unknown) {
      error = e
    }

    expect(error).to.be.instanceOf(AccessException)
  }
}
