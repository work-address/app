import { expect } from 'chai'
import { Effect } from 'effect'
import moment from 'moment'
import { suite, test } from '@testdeck/mocha'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { TimeFixture } from '@/test/fixture/time-fixture'
import { Invoice } from '@/entity/invoice'
import { Project } from '@/entity/project'
import { Time } from '@/entity/time'
import { User } from '@/entity/user'
import { EInvoiceState } from '@/model/invoice'
import { EProjectState } from '@/model/project'
import { IRetentionReport } from '@/model/time'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeRepository } from '@/repository/time-repository'
import { UserRepository } from '@/repository/user-repository'
import { runPromise } from '@/service/effect-bridge'
import { RetentionJob } from '@/service/retention-job'
import { TimeManager } from '@/service/time-manager'

/**
 * The daily retention run (SUB-08, DEC-05): free history rotates with no
 * upload needed, and never before the owner has been shown it.
 *
 * Every case takes one instant, builds its entries relative to it and hands
 * the same instant to the job, so no assertion depends on how long the test
 * took between two clock reads.
 */
@suite()
export class RetentionJobTest extends AbstractDatabaseIntegration {
  protected job: RetentionJob
  protected projectFixture: ProjectFixture
  protected timeFixture: TimeFixture
  protected timeRepository: TimeRepository
  protected userRepository: UserRepository
  protected projectRepository: ProjectRepository
  protected invoiceRepository: InvoiceRepository

  private savedSecret: string | undefined

  constructor() {
    super()
    this.job = this.container.get('RetentionJob')
    this.projectFixture = this.container.get('ProjectFixture')
    this.timeFixture = this.container.get('TimeFixture')
    this.timeRepository = this.container.get('TimeRepository')
    this.userRepository = this.container.get('UserRepository')
    this.projectRepository = this.container.get('ProjectRepository')
    this.invoiceRepository = this.container.get('InvoiceRepository')
  }

  async after() {
    this.job.stop()
    // Drops the observer nextPass() put on the instance, back to the class's.
    delete (this.job as Partial<RetentionJob>).run

    if (this.savedSecret !== undefined) {
      this.parameters.entitlementSecret = this.savedSecret
      this.savedSecret = undefined
    }
  }

  private selfHosted(): void {
    this.savedSecret = this.parameters.entitlementSecret
    this.parameters.entitlementSecret = ''
  }

  /** A ten-minute entry that started `daysAgo` days before `now`. */
  private entry(
    project: Project,
    now: Date,
    daysAgo: number,
    author?: User,
  ): Promise<Time> {
    const from = moment.utc(now).subtract(daysAgo, 'days').toDate()

    return this.timeFixture.create(
      project,
      from,
      moment.utc(from).add(10, 'minutes').toDate(),
      author,
    )
  }

  private async live(time: Time): Promise<boolean> {
    const found = await runPromise(
      this.timeRepository.findOneBy({ where: { id: time.id } }),
    )

    return Boolean(found)
  }

  private reload(user: User): Promise<User> {
    return runPromise(
      this.userRepository.findOneByOrFail({ where: { id: user.id } }),
    )
  }

  /**
   * Resolves with the report of the next pass the armed job makes by itself.
   * Nothing here waits out a duration: a schedule that never fires leaves
   * this pending, and the test fails on its timeout.
   */
  private nextPass(): Promise<IRetentionReport> {
    return new Promise((resolve) => {
      const run = RetentionJob.prototype.run.bind(this.job)

      this.job.run = (now?: Date) =>
        run(now).pipe(
          Effect.tap((report) => Effect.sync(() => resolve(report))),
        )
    })
  }

  private async freeOwnerWithProject(now: Date, told: boolean = true) {
    const owner = await this.userFixture.createUser()
    if (told) {
      await this.userFixture.tellOfRotation(owner, now)
    }
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    return { owner, project }
  }

  /** The acceptance case: 20 days old, no upload, one run - gone. */
  @test()
  async run_rotatesAFreeOwnersOldEntryWithNoUpload() {
    const now = new Date()
    const { project } = await this.freeOwnerWithProject(now)
    const old = await this.entry(project, now, 20)
    const fresh = await this.entry(project, now, 2)

    const report = await runPromise(this.job.run(now))

    expect(await this.live(old), 'rotated out of view').to.be.false
    expect(await this.live(fresh)).to.be.true
    expect(report.rotated).to.be.greaterThanOrEqual(1)

    // Soft-deleted: gone from every read path, but not erased by a job
    // nobody asked to run.
    const [kept] = await this.timeRepository
      .getRepo()
      .find({ where: { id: old.id }, withDeleted: true })
    expect(kept?.deletedAt).to.be.ok
  }

  /**
   * DEC-05: the first run that finds an owner free starts their notice and
   * removes nothing; the entry goes only once the notice has run its course.
   */
  @test()
  async run_tellsTheOwnerFirstAndRotatesOnlyAfterTheNotice() {
    const now = new Date()
    const { owner, project } = await this.freeOwnerWithProject(now, false)
    const old = await this.entry(project, now, 20)

    await runPromise(this.job.run(now))

    expect(await this.live(old), 'not before the owner is told').to.be.true
    const told = await this.reload(owner)
    expect(told.retentionNoticeFrom?.getTime()).to.be.eq(now.getTime())

    const almost = moment
      .utc(now)
      .add(RetentionJob.NOTICE_DAYS, 'days')
      .subtract(1, 'minute')
      .toDate()
    await runPromise(this.job.run(almost))
    expect(await this.live(old), 'the notice has not run out').to.be.true

    const after = moment.utc(now).add(RetentionJob.NOTICE_DAYS, 'days').toDate()
    await runPromise(this.job.run(after))
    expect(await this.live(old)).to.be.false
  }

  @test()
  async run_keepsAPremiumOwnersHistoryAndEndsTheirNotice() {
    const now = new Date()
    const owner = await this.userFixture.createPremiumUser()
    await this.userFixture.tellOfRotation(owner, now)
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const old = await this.entry(project, now, 40)

    await runPromise(this.job.run(now))

    expect(await this.live(old)).to.be.true
    expect(
      (await this.reload(owner)).retentionNoticeFrom,
      'a later lapse starts a fresh notice',
    ).to.be.null
  }

  /** Premium that has lapsed by its pushed validity is free again. */
  @test()
  async run_treatsALapsedValidityAsFree() {
    const now = new Date()
    const owner = await this.userFixture.createPremiumUser()
    await runPromise(
      this.userRepository.applyEntitlement(
        owner.id,
        true,
        1,
        moment.utc(now).subtract(1, 'hour').toDate(),
      ),
    )
    await this.userFixture.tellOfRotation(owner, now)
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const old = await this.entry(project, now, 20)

    await runPromise(this.job.run(now))

    expect(await this.live(old)).to.be.false
  }

  /**
   * The invoice-evidence exemption holds under the job: an entry overlapping
   * the same issuer's invoice stays, the uninvoiced one beside it goes.
   */
  @test()
  async run_keepsEntriesCoveredByTheIssuersInvoice() {
    const now = new Date()
    const { owner, project } = await this.freeOwnerWithProject(now)
    const invoicedFrom = moment.utc(now).subtract(30, 'days')
    const invoicedTo = moment.utc(now).subtract(25, 'days')
    const invoiced = await this.timeFixture.create(
      project,
      invoicedFrom.clone().add(1, 'day').toDate(),
      invoicedFrom.clone().add(1, 'day').add(10, 'minutes').toDate(),
      owner,
    )
    const uninvoiced = await this.entry(project, now, 20, owner)

    const invoice = new Invoice()
    invoice.project = project
    invoice.user = owner
    invoice.fromAt = invoicedFrom.toDate()
    invoice.toAt = invoicedTo.toDate()
    invoice.amountCents = 10_000
    invoice.state = EInvoiceState.REQUESTED
    await runPromise(this.invoiceRepository.saveSingle(invoice))

    await runPromise(this.job.run(now))

    expect(await this.live(invoiced), 'invoice evidence').to.be.true
    expect(await this.live(uninvoiced)).to.be.false
  }

  /**
   * A running marketplace contract's hours are escrow evidence; once the
   * marketplace ends the contract the project rotates like any other.
   */
  @test()
  async run_leavesARunningMarketplaceContractsEvidence() {
    const now = new Date()
    const client = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    await this.userFixture.tellOfRotation(client, now)
    const project = await this.projectFixture.createHired(client, worker)
    const old = await this.entry(project, now, 20, worker)

    await runPromise(this.job.run(now))
    expect(await this.live(old), 'contract still running').to.be.true

    project.state = EProjectState.INACTIVE
    await runPromise(this.projectRepository.saveSingle(project))

    await runPromise(this.job.run(now))
    expect(await this.live(old), 'contract ended').to.be.false
  }

  /** Self-host: the job is never armed, and a direct run touches nothing. */
  @test()
  async selfHosted_theJobIsNotScheduledAndRotatesNothing() {
    const now = new Date()
    const { project } = await this.freeOwnerWithProject(now)
    const old = await this.entry(project, now, 20)
    this.selfHosted()

    expect(this.job.start(), 'not armed').to.be.false
    expect(this.job.running).to.be.false

    const report = await runPromise(this.job.run(now))

    expect(report).to.deep.eq({ owners: 0, noticed: 0, rotated: 0, cleared: 0 })
    expect(await this.live(old)).to.be.true
  }

  @test()
  saas_theJobIsArmed() {
    expect(this.job.start(), 'armed').to.be.true
    expect(this.job.running).to.be.true
  }

  /**
   * Arming has to lead to a pass without a day of uptime. The production
   * container restarts on every deploy, a timer counts from boot, and the
   * upload path rotates only after this job has started the owner's notice:
   * armed as a bare 24-hour interval, an API deployed daily enforced nothing.
   * Here the interval is a day and only the first pass is near, so the notice
   * below can only come from the pass that follows arming.
   */
  @test()
  async saas_anArmedJobMakesItsFirstPassSoonAfterBoot() {
    const now = new Date()
    const { owner, project } = await this.freeOwnerWithProject(now, false)
    const old = await this.entry(project, now, 20)
    const passed = this.nextPass()

    this.job.start({ firstRunDelayMs: 1, intervalMs: 24 * 60 * 60 * 1000 })
    const report = await passed

    expect(report.noticed, 'the pass told the owner').to.be.greaterThanOrEqual(
      1,
    )
    expect((await this.reload(owner)).retentionNoticeFrom).to.be.ok
    expect(await this.live(old), 'told first, nothing removed').to.be.true
  }

  /** And it keeps going: with the first pass far off, the interval fires. */
  @test()
  async saas_anArmedJobPassesAgainOnItsInterval() {
    const now = new Date()
    const { owner, project } = await this.freeOwnerWithProject(now, false)
    await this.entry(project, now, 20)
    const passed = this.nextPass()

    this.job.start({ firstRunDelayMs: 24 * 60 * 60 * 1000, intervalMs: 1 })
    await passed

    expect((await this.reload(owner)).retentionNoticeFrom).to.be.ok
  }

  /**
   * What app.ts arms with. A first pass or an interval anywhere near a day
   * brings the restart problem back, whatever the injected schedules prove.
   */
  @test()
  saas_theDefaultScheduleOutlivesNoDeploy() {
    expect(RetentionJob.FIRST_RUN_DELAY_MS).to.be.at.most(5 * 60 * 1000)
    expect(RetentionJob.INTERVAL_MS).to.be.at.most(60 * 60 * 1000)
  }

  @test()
  saas_aStoppedJobHoldsNoTimer() {
    this.job.start()
    this.job.stop()

    expect(this.job.running).to.be.false
  }

  /**
   * The dashboard notice lists what will be old enough to rotate within
   * the lead time, and when the first of it goes.
   */
  @test()
  async notice_listsWhatRotatesWithinTheLeadTime() {
    const now = new Date()
    const { owner, project } = await this.freeOwnerWithProject(now, false)
    await this.userFixture.tellOfRotation(owner, now, 2)
    const soonest = TimeManager.freeTimeLogRetentionDays - 2
    await this.entry(project, now, soonest)
    await this.entry(project, now, 5)

    const notice = await runPromise(
      this.job.notice(await this.reload(owner), now),
    )

    expect(notice.count, 'only the entry due within the lead time').to.eq(1)
    expect(notice.rotatesAt).to.eq(
      moment.utc(now).add(2, 'days').toDate().toISOString(),
    )
    expect(notice.windowDays).to.eq(TimeManager.freeTimeLogRetentionDays)
    expect(notice.noticeDays).to.eq(RetentionJob.NOTICE_DAYS)
  }

  /**
   * For an owner the job has not told yet, even long-expired history is
   * announced for the full lead time from now, never as already gone.
   */
  @test()
  async notice_anOwnerNotYetToldGetsTheFullLeadTime() {
    const now = new Date()
    const { owner, project } = await this.freeOwnerWithProject(now, false)
    await this.entry(project, now, 40)

    const notice = await runPromise(
      this.job.notice(await this.reload(owner), now),
    )

    expect(notice.count).to.eq(1)
    expect(notice.rotatesAt).to.eq(
      moment.utc(now).add(RetentionJob.NOTICE_DAYS, 'days').toISOString(),
    )
  }

  @test()
  async notice_isEmptyForPremiumAndOnSelfHost() {
    const now = new Date()
    const premium = await this.userFixture.createPremiumUser()
    const premiumProject = await this.projectFixture.create(
      premium,
      EProjectState.ACTIVE,
    )
    await this.entry(premiumProject, now, 20)
    const { owner, project } = await this.freeOwnerWithProject(now)
    await this.entry(project, now, 20)

    const forPremium = await runPromise(this.job.notice(premium, now))
    this.selfHosted()
    const onSelfHost = await runPromise(
      this.job.notice(await this.reload(owner), now),
    )

    expect(forPremium).to.include({ count: 0, rotatesAt: null })
    expect(onSelfHost).to.include({ count: 0, rotatesAt: null })
  }
}
