import { expect } from 'chai'
import moment from 'moment'
import { suite, test } from '@testdeck/mocha'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { ConcurrentCalls } from '@/test/fixture/concurrent-calls'
import { InvoiceManager } from '@/service/invoice-manager'
import { TimeManager } from '@/service/time-manager'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeFixture } from '@/test/fixture/time-fixture'
import { TimeRepository } from '@/repository/time-repository'
import AccessException from '@/exception/access-exception'
import { EProjectState } from '@/model/project'
import { TimeCreateDto } from '@/model/dto/time'
import { Invoice } from '@/entity/invoice'
import { Time } from '@/entity/time'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { UserManager } from '@/service/user-manager'
import { EInvoiceState } from '@/model/invoice'
import { runPromise } from '@/service/effect-bridge'

@suite()
export class TimeManagerTest extends AbstractDatabaseIntegration {
  /**
   * Days ago that is comfortably outside the free-tier retention window,
   * derived from the constant rather than hardcoded. These tests previously
   * pinned literals chosen against a 7-day window and silently stopped
   * exercising the purge when the window widened to 14.
   */
  private static staleDays(offset: number = 1): number {
    return TimeManager.freeTimeLogRetentionDays + offset
  }

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
    // One clock read, both ends derived from it: an exact ten-minute slice.
    const toAt = moment.utc()
    const fromAt = toAt.clone().subtract(10, 'minutes')

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
    await runPromise(this.projectRepository.saveSingle(project))

    const [result] = await runPromise(
      this.timeManager.createOrUpdateMany(
        [this.buildTimePayload(project.id, 1)],
        worker,
      ),
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
    await runPromise(this.projectRepository.saveSingle(project))

    const [result] = await runPromise(
      this.timeManager.createOrUpdateMany(
        [this.buildTimePayload(project.id, 2)],
        viewer,
      ),
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
    await runPromise(this.projectRepository.saveSingle(project))

    const [result] = await runPromise(
      this.timeManager.createOrUpdateMany(
        [this.buildTimePayload(project.id, 3)],
        worker,
      ),
    )

    expect(result.error).to.exist
    expect(result.error?.name).to.be.equal('EntityNotFoundError')
  }

  /**
   * Every other case here sends a one-entry batch, which never exercised the
   * reason this method handles entries individually: a tracker syncs several at
   * once, and one bad entry has to come back as an error in its own slot while
   * its neighbours are still stored.
   */
  @test()
  async createOrUpdateMany_keepsGoodEntriesWhenOneInTheBatchFails() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    // Distinct windows so the entries cannot collide with each other on
    // (project, fromAt, toAt) and update in place instead of inserting.
    const shift = (payload: TimeCreateDto, minutes: number): TimeCreateDto => ({
      ...payload,
      fromAt: moment.utc(payload.fromAt).subtract(minutes, 'm').toISOString(),
      toAt: moment.utc(payload.toAt).subtract(minutes, 'm').toISOString(),
    })

    const batch = [
      shift(this.buildTimePayload(project.id, 60), 0),
      // Unknown project: findProjectForTimeTracking raises EntityNotFoundError.
      shift(
        this.buildTimePayload('d650ad83-eab3-4200-9bf2-479a47c59892', 61),
        30,
      ),
      shift(this.buildTimePayload(project.id, 62), 60),
    ]

    const results = await runPromise(
      this.timeManager.createOrUpdateMany(batch, owner),
    )

    expect(results.length).to.be.equal(3)

    // Results stay aligned with the submitted order - the tracker reconciles
    // its local rows positionally, so a dropped or reordered slot corrupts it.
    expect(results.map((result) => result.note)).to.deep.equal(
      batch.map((payload) => payload.note),
    )

    expect(results[0].error).to.be.undefined
    expect(results[0].id).to.be.a('string')

    expect(results[1].error).to.exist
    expect(results[1].error?.name).to.be.equal('EntityNotFoundError')
    expect(results[1].id).to.be.undefined

    expect(results[2].error).to.be.undefined
    expect(results[2].id).to.be.a('string')

    // The two good entries are actually persisted, not just reported as such.
    const stored = await runPromise(
      this.timeRepository.findBy({
        where: { project: { id: project.id } },
      }),
    )
    expect(stored.length).to.be.equal(2)
  }

  /**
   * The method returns an Effect - a description, not work already in flight -
   * so running one twice must behave like running two.
   *
   * It used to capture the retention cutoff and the set of projects to purge
   * when the effect was *built*. A second run of the same effect therefore
   * inherited the first run's bookkeeping and would purge a project the second
   * run never touched. This drives that difference: the project is deactivated
   * between the runs, so the second run registers nothing of its own, and a
   * leaked set is the only thing that could delete the entry added in between.
   */
  @test()
  async createOrUpdateMany_effectCarriesNoRetentionStateBetweenRuns() {
    const owner = await this.userFixture.createUser() // free tier
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    // Built once, run twice - the point of the test.
    const effect = this.timeManager.createOrUpdateMany(
      [this.buildTimePayload(project.id, 70)],
      owner,
    )

    const [firstResult] = await runPromise(effect)
    expect(firstResult.error, 'first run should store the entry').to.be
      .undefined

    // Added after the first run, so only a purge triggered by the *second* run
    // could remove it.
    const staleFrom = moment
      .utc()
      .subtract(TimeManagerTest.staleDays(), 'days')
      .toDate()
    const stale = await this.timeFixture.create(
      project,
      staleFrom,
      moment.utc(staleFrom).add(10, 'minutes').toDate(),
    )

    // Deactivating the project makes the second run fail its project lookup, so
    // it registers nothing for retention on its own.
    project.state = EProjectState.INACTIVE
    await runPromise(this.projectRepository.saveSingle(project))

    const [secondResult] = await runPromise(effect)
    expect(secondResult.error?.name).to.be.equal('EntityNotFoundError')

    // The backlogged entry survives: the second run had no project of its own
    // under retention, so it must not have purged anything.
    const survivor = await runPromise(
      this.timeRepository.findOneBy({ where: { id: stale.id } }),
    )
    expect(survivor, 'second run purged a project it never touched').to.exist
  }

  /**
   * G2. Every tracker aligns to the same ten-minute buckets, so two people
   * tracking one project at the same time send the same slice. The key used
   * to be (project, fromAt): the second author was refused with "Wrong user"
   * and their tracker dropped the row for good. Each author now keeps their
   * own row, and the project's totals count both.
   */
  @test()
  async createOrUpdateMany_twoWorkersPostingTheSameSlice_bothKeepTheirRows() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const otherWorker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address, otherWorker.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const payload = this.buildTimePayload(project.id, 4)
    const [first] = await runPromise(
      this.timeManager.createOrUpdateMany([payload], worker),
    )
    const [second] = await runPromise(
      this.timeManager.createOrUpdateMany(
        [
          {
            ...payload,
            note: 'the other worker',
            minutesActive: 6,
            keyboardKeys: 40,
          },
        ],
        otherWorker,
      ),
    )

    expect(first.error).to.be.undefined
    expect(second.error).to.be.undefined
    expect(first.id).to.be.a('string')
    expect(second.id).to.be.a('string')
    expect(second.id).to.not.equal(first.id)

    const stored = await this.conn.getRepository(Time).find({
      where: { project: { id: project.id } },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    })

    expect(
      stored.map((row) => [row.user.id, row.note, row.minutesActive]),
    ).to.deep.equal([
      [worker.id, payload.note, payload.minutesActive],
      [otherWorker.id, 'the other worker', 6],
    ])

    const [totals] = await runPromise(
      this.timeRepository.getTotals(owner, project.id),
    )

    expect(totals.minutesActive).to.equal(payload.minutesActive + 6)
    expect(totals.keyboardKeys).to.equal(payload.keyboardKeys + 40)
  }

  /** The same author re-sending a slice updates their row; no second one. */
  @test()
  async createOrUpdateMany_sameAuthorRepostingASlice_updatesTheirOwnRow() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const payload = this.buildTimePayload(project.id, 5)
    const [ownerRow] = await runPromise(
      this.timeManager.createOrUpdateMany([payload], owner),
    )
    const [first] = await runPromise(
      this.timeManager.createOrUpdateMany([payload], worker),
    )
    const [again] = await runPromise(
      this.timeManager.createOrUpdateMany(
        [{ ...payload, note: 'resent', minutesActive: 9 }],
        worker,
      ),
    )

    expect(again.error).to.be.undefined
    expect(again.id).to.equal(first.id)

    const stored = await this.conn.getRepository(Time).find({
      where: { project: { id: project.id } },
      relations: { user: true },
    })
    const byAuthor = new Map(stored.map((row) => [row.user.id, row]))

    expect(stored.length).to.equal(2)
    expect(byAuthor.get(worker.id)?.id).to.equal(first.id)
    expect(byAuthor.get(worker.id)?.note).to.equal('resent')
    expect(byAuthor.get(worker.id)?.minutesActive).to.equal(9)
    // The owner's row for the same slice is theirs and untouched.
    expect(byAuthor.get(owner.id)?.id).to.equal(ownerRow.id)
    expect(byAuthor.get(owner.id)?.note).to.equal(payload.note)
  }

  /**
   * The key itself: the database refuses a second row for one author and
   * slice, and accepts one from another author. Written past the manager,
   * so it is the constraint answering and not the lookup.
   */
  @test()
  async timeUniqueKey_isProjectAuthorAndFromAt() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const now = moment.utc()
    const fromAt = now.clone().subtract(10, 'minutes').toDate()
    const toAt = now.toDate()

    await this.timeFixture.create(project, fromAt, toAt, owner)
    await this.timeFixture.create(project, fromAt, toAt, worker)

    let error: unknown

    try {
      await this.timeFixture.create(project, fromAt, toAt, worker)
    } catch (e: unknown) {
      error = e
    }

    expect((error as { driverError?: { constraint?: string } }).driverError)
      .to.have.property('constraint')
      .equal('UQ_TIME_PROJECT_USER_FROM_AT')
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

    await runPromise(this.timeManager.setIsPaidMany([time.id], true, owner))

    const updated = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: time.id },
      }),
    )
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
    await runPromise(this.projectRepository.saveSingle(project))

    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
      worker,
    )

    let error: unknown

    try {
      await runPromise(this.timeManager.setIsPaidMany([time.id], true, owner))
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
      moment
        .utc()
        .subtract(TimeManagerTest.staleDays(), 'days')
        .subtract(10, 'minutes')
        .toDate(),
      moment.utc().subtract(TimeManagerTest.staleDays(), 'days').toDate(),
      owner,
    )
    const freshEntry = await this.timeFixture.create(
      project,
      moment.utc().subtract(2, 'days').subtract(10, 'minutes').toDate(),
      moment.utc().subtract(2, 'days').toDate(),
      owner,
    )

    await runPromise(
      this.timeManager.createOrUpdateMany(
        [this.buildTimePayload(project.id, 5)],
        owner,
      ),
    )

    const stale = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: staleEntry.id },
      }),
    )
    const fresh = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: freshEntry.id },
      }),
    )

    expect(stale).to.be.undefined
    expect(fresh).to.exist

    // ...and the purged entry is gone from the real read path too, not just
    // from a direct id lookup.
    const [rows] = await runPromise(
      this.timeRepository.findAndCount(
        { filter: {}, sort: { createdAt: 'ASC' }, page: 0 },
        owner,
      ),
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

    await runPromise(
      this.timeManager.createOrUpdateMany(
        [this.buildTimePayload(project.id, 6)],
        owner,
      ),
    )

    const stale = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: staleEntry.id },
      }),
    )

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
    await runPromise(this.projectRepository.saveSingle(project))

    const ownerStaleEntry = await this.timeFixture.create(
      project,
      moment
        .utc()
        .subtract(TimeManagerTest.staleDays(), 'days')
        .subtract(10, 'minutes')
        .toDate(),
      moment.utc().subtract(TimeManagerTest.staleDays(), 'days').toDate(),
      owner,
    )
    const workerStaleEntry = await this.timeFixture.create(
      project,
      moment
        .utc()
        .subtract(TimeManagerTest.staleDays(6), 'days')
        .subtract(10, 'minutes')
        .toDate(),
      moment.utc().subtract(TimeManagerTest.staleDays(6), 'days').toDate(),
      worker,
    )

    const [result] = await runPromise(
      this.timeManager.createOrUpdateMany(
        [this.buildTimePayload(project.id, 7)],
        worker,
      ),
    )

    expect(result.error).to.be.undefined

    const ownerStale = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: ownerStaleEntry.id },
      }),
    )
    const workerStale = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: workerStaleEntry.id },
      }),
    )

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
    await runPromise(this.projectRepository.saveSingle(project))

    const staleEntry = await this.timeFixture.create(
      project,
      moment
        .utc()
        .subtract(TimeManagerTest.staleDays(), 'days')
        .subtract(10, 'minutes')
        .toDate(),
      moment.utc().subtract(TimeManagerTest.staleDays(), 'days').toDate(),
      worker,
    )

    // The owner downgrades after the fact; the project falls under free-tier
    // retention from the next sync onwards.
    owner.premium = false
    await runPromise(this.userManager.saveSingle(owner))

    await runPromise(
      this.timeManager.createOrUpdateMany(
        [this.buildTimePayload(project.id, 8)],
        owner,
      ),
    )

    const stale = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: staleEntry.id },
      }),
    )

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
    backlog.fromAt = moment
      .utc()
      .subtract(TimeManagerTest.staleDays(), 'days')
      .toISOString()
    backlog.toAt = moment
      .utc()
      .subtract(TimeManagerTest.staleDays(), 'days')
      .add(10, 'minutes')
      .toISOString()

    const [result] = await runPromise(
      this.timeManager.createOrUpdateMany([backlog], owner),
    )

    expect(result.id).to.be.undefined
    expect(result.error).to.exist
    expect(result.error?.name).to.be.equal('RetentionExceededException')

    // Nothing was written at all - not written-then-removed.
    const stored = await runPromise(
      this.timeRepository.findBy({
        where: { project: { id: project.id } },
      }),
    )
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

    const invoicedFrom = moment
      .utc()
      .subtract(TimeManagerTest.staleDays(10), 'days')
    const invoicedTo = moment
      .utc()
      .subtract(TimeManagerTest.staleDays(5), 'days')

    const invoicedEntry = await this.timeFixture.create(
      project,
      invoicedFrom.clone().add(1, 'day').toDate(),
      invoicedFrom.clone().add(1, 'day').add(10, 'minutes').toDate(),
      owner,
    )
    const uninvoicedEntry = await this.timeFixture.create(
      project,
      moment.utc().subtract(TimeManagerTest.staleDays(), 'days').toDate(),
      moment
        .utc()
        .subtract(TimeManagerTest.staleDays(), 'days')
        .add(10, 'minutes')
        .toDate(),
      owner,
    )

    const invoice = new Invoice()
    invoice.project = project
    invoice.fromAt = invoicedFrom.toDate()
    invoice.toAt = invoicedTo.toDate()
    invoice.amountCents = 10_000
    invoice.state = EInvoiceState.REQUESTED
    await runPromise(this.invoiceRepository.saveSingle(invoice))

    await runPromise(
      this.timeManager.createOrUpdateMany(
        [this.buildTimePayload(project.id, 10)],
        owner,
      ),
    )

    const invoiced = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: invoicedEntry.id },
      }),
    )
    const uninvoiced = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: uninvoicedEntry.id },
      }),
    )

    expect(invoiced).to.exist
    expect(uninvoiced).to.be.undefined
  }

  /**
   * A hand-made paid mark racing an invoice for the same entry. Whichever
   * wins, the records must agree: either the entry is paid and on no
   * invoice, or it is on the (unpaid) invoice and the mark was refused. The
   * mark used to read the entry, then write it, with the invoice free to
   * claim it in between - ending paid under a REQUESTED invoice. Run over
   * several entries so both orders get exercised.
   */
  @test()
  async setIsPaidMany_racingAnInvoice_neverLeavesThemDisagreeing() {
    const invoiceManager: InvoiceManager = this.container.get('InvoiceManager')
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const now = moment.utc()

    for (let round = 1; round <= 6; round += 1) {
      const entry = await this.timeFixture.create(
        project,
        now.clone().subtract(round, 'hours').toDate(),
        now.clone().subtract(round, 'hours').add(30, 'minutes').toDate(),
        owner,
      )

      const [mark] = await new ConcurrentCalls(this.conn).settle<unknown>([
        () =>
          runPromise(this.timeManager.setIsPaidMany([entry.id], true, owner)),
        () => runPromise(invoiceManager.ensureForProject(project, owner)),
      ])

      const stored = await this.conn.getRepository(Time).findOneOrFail({
        where: { id: entry.id },
        relations: { invoice: true },
      })

      if (stored.invoice) {
        expect(stored.invoice.state, `round ${round}`).to.equal(
          EInvoiceState.REQUESTED,
        )
        expect(stored.isPaid, `round ${round}`).to.be.false
        expect(mark.status, `round ${round}`).to.equal('rejected')
      } else {
        expect(stored.isPaid, `round ${round}`).to.be.true
      }
    }
  }
}
