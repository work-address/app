import { expect } from 'chai'
import moment from 'moment'
import { suite, test } from '@testdeck/mocha'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { TimeManager } from '@/service/time-manager'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeFixture } from '@/test/fixture/time-fixture'
import { TimeRepository } from '@/repository/time-repository'
import AccessException from '@/exception/access-exception'
import { EProjectState } from '@/model/project'
import { TimeCreateDto } from '@/model/dto/time'
import { Invoice } from '@/entity/invoice'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { UserManager } from '@/service/user-manager'
import { EInvoiceState } from '@/model/invoice'

@suite()
export class TimeManagerTest extends AbstractDatabaseIntegration {
  protected timeManager: TimeManager
  protected projectFixture: ProjectFixture
  protected projectRepository: ProjectRepository
  protected timeFixture: TimeFixture
  protected timeRepository: TimeRepository
  protected invoiceRepository: InvoiceRepository
  protected userManager: UserManager

  constructor() {
    super()
    this.timeManager = this.container.get('TimeManager')
    this.projectFixture = this.container.get('ProjectFixture')
    this.projectRepository = this.container.get('ProjectRepository')
    this.timeFixture = this.container.get('TimeFixture')
    this.timeRepository = this.container.get('TimeRepository')
    this.invoiceRepository = this.container.get('InvoiceRepository')
    this.userManager = this.container.get('UserManager')
  }

  private buildTimePayload(
    projectId: string,
    userSuffix: number,
  ): TimeCreateDto {
    const fromAt = moment.utc().subtract(10, 'minutes')
    const toAt = moment.utc()

    return {
      fromIndex: userSuffix,
      toIndex: userSuffix + 1,
      note: `entry-${userSuffix}`,
      keyboardKeys: 1,
      minutesActive: 10,
      mouseKeys: 1,
      mouseDistance: 1,
      fromAt: fromAt.toISOString(),
      toAt: toAt.toISOString(),
      projectId,
    }
  }

  @test()
  async createOrUpdateMany_savesTimeForWorkerOnActiveProject() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    await this.projectRepository.saveSingle(project)

    const [result] = await this.timeManager.createOrUpdateMany(
      [this.buildTimePayload(project.id, 1)],
      worker,
    )

    expect(result.error).to.be.undefined
    expect(result.id).to.be.a('string')
  }

  @test()
  async createOrUpdateMany_returnsErrorForViewerOnSharedProject() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    project.viewerAddresses = [viewer.address]
    await this.projectRepository.saveSingle(project)

    const [result] = await this.timeManager.createOrUpdateMany(
      [this.buildTimePayload(project.id, 2)],
      viewer,
    )

    expect(result.error).to.exist
    expect(result.error?.name).to.be.equal('EntityNotFoundError')
    expect(result.id).to.be.undefined
  }

  @test()
  async createOrUpdateMany_returnsErrorWhenProjectInactive() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.INACTIVE,
    )
    project.workerAddresses = [worker.address]
    await this.projectRepository.saveSingle(project)

    const [result] = await this.timeManager.createOrUpdateMany(
      [this.buildTimePayload(project.id, 3)],
      worker,
    )

    expect(result.error).to.exist
    expect(result.error?.name).to.be.equal('EntityNotFoundError')
  }

  @test()
  async createOrUpdateMany_returnsErrorWhenUpdatingAnotherUsersEntry() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const otherWorker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address, otherWorker.address]
    await this.projectRepository.saveSingle(project)

    const payload = this.buildTimePayload(project.id, 4)
    const [saved] = await this.timeManager.createOrUpdateMany([payload], worker)
    expect(saved.id).to.be.a('string')

    const [result] = await this.timeManager.createOrUpdateMany(
      [{ ...payload, note: 'stolen update' }],
      otherWorker,
    )

    expect(result.error).to.exist
    expect(result.error?.name).to.be.equal('UserAccessException')
  }

  @test()
  async setIsPaidMany_allowsAuthorToMarkOwnEntries() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
      owner,
    )

    await this.timeManager.setIsPaidMany([time.id], true, owner)

    const updated = await this.timeRepository.findOneBy({
      where: { id: time.id },
    })
    expect(updated!.isPaid).to.be.true
  }

  @test()
  async setIsPaidMany_deniesNonAuthorEvenWhenProjectOwner() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    await this.projectRepository.saveSingle(project)

    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
      worker,
    )

    let error: unknown

    try {
      await this.timeManager.setIsPaidMany([time.id], true, owner)
    } catch (e: unknown) {
      error = e
    }

    expect(error).to.be.instanceOf(AccessException)
  }

  @test()
  async createOrUpdateMany_freeOwner_purgesOwnProjectEntriesOlderThanWindow() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    const staleEntry = await this.timeFixture.create(
      project,
      moment.utc().subtract(8, 'days').subtract(10, 'minutes').toDate(),
      moment.utc().subtract(8, 'days').toDate(),
      owner,
    )
    const freshEntry = await this.timeFixture.create(
      project,
      moment.utc().subtract(2, 'days').subtract(10, 'minutes').toDate(),
      moment.utc().subtract(2, 'days').toDate(),
      owner,
    )

    await this.timeManager.createOrUpdateMany(
      [this.buildTimePayload(project.id, 5)],
      owner,
    )

    const stale = await this.timeRepository.findOneBy({
      where: { id: staleEntry.id },
    })
    const fresh = await this.timeRepository.findOneBy({
      where: { id: freshEntry.id },
    })

    expect(stale).to.be.undefined
    expect(fresh).to.exist

    // ...and the purged entry is gone from the real read path too, not just
    // from a direct id lookup.
    const [rows] = await this.timeRepository.findAndCount(
      { filter: {}, sort: { createdAt: 'ASC' }, page: 0 },
      owner,
    )
    const visibleIds = rows.map((row) => row.id)
    expect(visibleIds).to.not.include(staleEntry.id)
    expect(visibleIds).to.include(freshEntry.id)
  }

  @test()
  async createOrUpdateMany_premiumOwner_keepsEntriesOlderThanWindow() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    const staleEntry = await this.timeFixture.create(
      project,
      moment.utc().subtract(30, 'days').subtract(10, 'minutes').toDate(),
      moment.utc().subtract(30, 'days').toDate(),
      owner,
    )

    await this.timeManager.createOrUpdateMany(
      [this.buildTimePayload(project.id, 6)],
      owner,
    )

    const stale = await this.timeRepository.findOneBy({
      where: { id: staleEntry.id },
    })

    expect(stale).to.exist
  }

  /**
   * Retention follows the project owner's plan, not the author's. A free-tier
   * worker syncing time must not purge history on a premium client's project -
   * that history is what the client is paying to keep.
   */
  @test()
  async createOrUpdateMany_freeWorker_doesNotPurgePremiumOwnersProject() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    await this.projectRepository.saveSingle(project)

    const ownerStaleEntry = await this.timeFixture.create(
      project,
      moment.utc().subtract(10, 'days').subtract(10, 'minutes').toDate(),
      moment.utc().subtract(10, 'days').toDate(),
      owner,
    )
    const workerStaleEntry = await this.timeFixture.create(
      project,
      moment.utc().subtract(20, 'days').subtract(10, 'minutes').toDate(),
      moment.utc().subtract(20, 'days').toDate(),
      worker,
    )

    const [result] = await this.timeManager.createOrUpdateMany(
      [this.buildTimePayload(project.id, 7)],
      worker,
    )

    expect(result.error).to.be.undefined

    const ownerStale = await this.timeRepository.findOneBy({
      where: { id: ownerStaleEntry.id },
    })
    const workerStale = await this.timeRepository.findOneBy({
      where: { id: workerStaleEntry.id },
    })

    expect(ownerStale).to.exist
    expect(workerStale).to.exist
  }

  /**
   * A premium worker on a free owner's project is still subject to that
   * project's retention - the entitlement belongs to the project, not to
   * whoever happens to be typing.
   */
  @test()
  async createOrUpdateMany_premiumWorker_stillPurgedOnFreeOwnersProject() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    await this.projectRepository.saveSingle(project)

    const staleEntry = await this.timeFixture.create(
      project,
      moment.utc().subtract(9, 'days').subtract(10, 'minutes').toDate(),
      moment.utc().subtract(9, 'days').toDate(),
      worker,
    )

    // The owner downgrades after the fact; the project falls under free-tier
    // retention from the next sync onwards.
    owner.premium = false
    await this.userManager.saveSingle(owner)

    await this.timeManager.createOrUpdateMany(
      [this.buildTimePayload(project.id, 8)],
      owner,
    )

    const stale = await this.timeRepository.findOneBy({
      where: { id: staleEntry.id },
    })

    expect(stale).to.be.undefined
  }

  /**
   * An offline tracker syncing a backlog must be told the entry was refused.
   * Storing it and purging it in the same request would hand the client an id
   * for a row that no longer exists, and the client would drop its local copy.
   */
  @test()
  async createOrUpdateMany_freeOwner_rejectsBacklogInsteadOfAcceptingThenPurging() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    const backlog = this.buildTimePayload(project.id, 9)
    backlog.fromAt = moment.utc().subtract(10, 'days').toISOString()
    backlog.toAt = moment
      .utc()
      .subtract(10, 'days')
      .add(10, 'minutes')
      .toISOString()

    const [result] = await this.timeManager.createOrUpdateMany([backlog], owner)

    expect(result.id).to.be.undefined
    expect(result.error).to.exist
    expect(result.error?.name).to.be.equal('RetentionExceededException')

    // Nothing was written at all - not written-then-removed.
    const stored = await this.timeRepository.findBy({ where: { project } })
    expect(stored).to.deep.equal([])
  }

  /**
   * A retention purge must never remove the detail backing an issued invoice.
   */
  @test()
  async createOrUpdateMany_freeOwner_keepsEntriesCoveredByAnInvoice() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    const invoicedFrom = moment.utc().subtract(20, 'days')
    const invoicedTo = moment.utc().subtract(15, 'days')

    const invoicedEntry = await this.timeFixture.create(
      project,
      invoicedFrom.clone().add(1, 'day').toDate(),
      invoicedFrom.clone().add(1, 'day').add(10, 'minutes').toDate(),
      owner,
    )
    const uninvoicedEntry = await this.timeFixture.create(
      project,
      moment.utc().subtract(9, 'days').toDate(),
      moment.utc().subtract(9, 'days').add(10, 'minutes').toDate(),
      owner,
    )

    const invoice = new Invoice()
    invoice.project = project
    invoice.fromAt = invoicedFrom.toDate()
    invoice.toAt = invoicedTo.toDate()
    invoice.amount = 100
    invoice.state = EInvoiceState.REQUESTED
    await this.invoiceRepository.saveSingle(invoice)

    await this.timeManager.createOrUpdateMany(
      [this.buildTimePayload(project.id, 10)],
      owner,
    )

    const invoiced = await this.timeRepository.findOneBy({
      where: { id: invoicedEntry.id },
    })
    const uninvoiced = await this.timeRepository.findOneBy({
      where: { id: uninvoicedEntry.id },
    })

    expect(invoiced).to.exist
    expect(uninvoiced).to.be.undefined
  }
}
