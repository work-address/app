import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import moment from 'moment-timezone'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { ConcurrentCalls } from '@/test/fixture/concurrent-calls'
import { Invoice } from '@/entity/invoice'
import { InvoiceManager } from '@/service/invoice-manager'
import { InvoiceCadence } from '@/service/invoice-cadence'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { InvoiceScheduler } from '@/service/invoice-scheduler'
import { Project } from '@/entity/project'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeFixture } from '@/test/fixture/time-fixture'
import { TimeRepository } from '@/repository/time-repository'
import { User } from '@/entity/user'
import { UserFixture } from '@/test/fixture/user-fixture'
import { EInvoiceIssuanceKind, EInvoiceState } from '@/model/invoice'
import { EProjectState } from '@/model/project'
import { IInvoiceCadenceVersion } from '@/model/project'
import { runPromise } from '@/service/effect-bridge'

const HOUR = 3600000

/** Mondays at 09:00 New York time, finalized a day later. */
const MONDAY_NY: IInvoiceCadenceVersion = {
  weekday: 1,
  timezone: 'America/New_York',
  cutoffLocal: '09:00',
  // Late enough that the catch-up walk stops here rather than at the cap.
  effectiveFrom: '2026-02-23T00:00:00.000Z',
  finalizationDelayHours: 24,
}

/**
 * The Monday cutoffs the cadence above produces around the 2026 spring
 * forward, as instants. New York is five hours behind UTC until 8 March and
 * four hours behind after it, so the week from the 2nd to the 9th is 167
 * hours - which is exactly why the scheduler is not allowed to add "a week"
 * in milliseconds anywhere.
 */
const CUTOFF = {
  feb23: '2026-02-23T14:00:00.000Z',
  mar02: '2026-03-02T14:00:00.000Z',
  mar09: '2026-03-09T13:00:00.000Z',
  mar16: '2026-03-16T13:00:00.000Z',
}

/** A minute past the moment each period's invoice becomes due. */
const DUE = {
  mar02: new Date(Date.parse(CUTOFF.mar02) + 24 * HOUR + 60000),
  mar09: new Date(Date.parse(CUTOFF.mar09) + 24 * HOUR + 60000),
  mar16: new Date(Date.parse(CUTOFF.mar16) + 24 * HOUR + 60000),
}

/**
 * WP-97: the schedule issues one invoice per project, issuer and period, it
 * catches up a period at a time, and running it again changes nothing.
 */
@suite()
export class InvoiceSchedulerTest extends AbstractDatabaseIntegration {
  protected projectFixture: ProjectFixture
  protected timeFixture: TimeFixture
  protected workerFixture: UserFixture
  protected scheduler: InvoiceScheduler
  protected invoiceManager: InvoiceManager
  protected invoiceRepository: InvoiceRepository
  protected timeRepository: TimeRepository
  protected projectRepository: ProjectRepository

  constructor() {
    super()

    this.projectFixture = this.container.get('ProjectFixture')
    this.timeFixture = this.container.get('TimeFixture')
    this.workerFixture = this.container.get('UserFixture')
    this.scheduler = this.container.get('InvoiceScheduler')
    this.invoiceManager = this.container.get('InvoiceManager')
    this.invoiceRepository = this.container.get('InvoiceRepository')
    this.timeRepository = this.container.get('TimeRepository')
    this.projectRepository = this.container.get('ProjectRepository')
  }

  /** The one criterion a weekly schedule cannot get wrong. */
  @test()
  async period_acrossADstChange_isNot168Hours() {
    const { project, worker } = await this.scheduled()

    await this.track(project, worker, CUTOFF.mar02, 60)

    await this.run(DUE.mar09)

    const [invoice] = await this.invoicesOf(project)

    expect(invoice.periodStart?.toISOString()).to.equal(CUTOFF.mar02)
    expect(invoice.periodEnd?.toISOString()).to.equal(CUTOFF.mar09)
    expect(
      (Number(invoice.periodEnd) - Number(invoice.periodStart)) / HOUR,
      'the week the clocks went forward',
    ).to.equal(167)
    // And the cutoff still reads 09:00 on both sides.
    expect(
      moment
        .tz(invoice.periodStart as Date, 'America/New_York')
        .format('HH:mm'),
    ).to.equal('09:00')
    expect(
      moment.tz(invoice.periodEnd as Date, 'America/New_York').format('HH:mm'),
    ).to.equal('09:00')
  }

  @test()
  async run_issuesOneInvoiceForTheDuePeriod() {
    const { project, worker } = await this.scheduled()

    await this.track(project, worker, CUTOFF.feb23, 120)

    const report = await this.run(DUE.mar02)

    expect(report.issued).to.equal(1)

    const invoices = await this.invoicesOf(project)

    expect(invoices).to.have.length(1)
    expect(invoices[0].user?.id).to.equal(worker.id)
    expect(invoices[0].issuanceKind).to.equal(EInvoiceIssuanceKind.SCHEDULED)
    expect(invoices[0].state).to.equal(EInvoiceState.REQUESTED)
    expect(invoices[0].periodEnd?.toISOString()).to.equal(CUTOFF.mar02)
    // 120 minutes at $60 an hour.
    expect(invoices[0].minutesActive).to.equal(120)
    expect(invoices[0].amountCents).to.equal(12000)
  }

  /** A period with nothing in it is not an event. */
  @test()
  async run_forAnEmptyPeriod_issuesNothing() {
    const { project } = await this.scheduled()

    const report = await this.run(DUE.mar02)

    expect(report.issued).to.equal(0)
    expect(report.empty).to.be.greaterThan(0)
    expect(await this.invoicesOf(project)).to.have.length(0)
  }

  /** The acceptance criterion: a rerun raises nothing new. */
  @test()
  async run_twice_isIdempotent() {
    const { project, worker } = await this.scheduled()

    await this.track(project, worker, CUTOFF.feb23, 90)

    const first = await this.run(DUE.mar02)
    const second = await this.run(DUE.mar02)

    expect(first.issued).to.equal(1)
    expect(second.issued).to.equal(0)
    expect(second.alreadyIssued).to.equal(1)

    const invoices = await this.invoicesOf(project)

    expect(invoices).to.have.length(1)
    expect(invoices[0].amountCents).to.equal(9000)
  }

  /**
   * Two runs at the same instant - a second process, a retried cron - are the
   * case the unique key on Invoice exists for. One wins, one reads the
   * winner's row, and nobody is billed twice.
   */
  @test()
  async run_concurrently_raisesOneInvoice() {
    const { project, worker } = await this.scheduled()

    await this.track(project, worker, CUTOFF.feb23, 45)

    const period = {
      start: CUTOFF.feb23,
      end: CUTOFF.mar02,
      issueAt: DUE.mar02.toISOString(),
    }
    const settled = await new ConcurrentCalls(this.conn).settle([
      () =>
        runPromise(this.invoiceManager.issueForPeriod(project, worker, period)),
      () =>
        runPromise(this.invoiceManager.issueForPeriod(project, worker, period)),
    ])

    const rejected = settled.filter((result) => result.status === 'rejected')
    const created = settled.filter(
      (result) => result.status === 'fulfilled' && result.value.created,
    )

    expect(rejected, JSON.stringify(rejected)).to.have.length(0)
    expect(created, 'exactly one call raised the invoice').to.have.length(1)
    expect(await this.invoicesOf(project)).to.have.length(1)
  }

  /**
   * Three weeks with nobody running it: three invoices, one per week, each
   * saying which week it bills. Not one invoice covering the lot.
   */
  @test()
  async run_afterAMissedRun_catchesUpOnePeriodPerWeek() {
    const { project, worker } = await this.scheduled()

    await this.track(project, worker, CUTOFF.feb23, 60)
    await this.track(project, worker, CUTOFF.mar02, 30)
    await this.track(project, worker, CUTOFF.mar09, 15)

    const report = await this.run(DUE.mar16)

    expect(report.issued).to.equal(3)

    const invoices = await this.invoicesOf(project)

    expect(
      invoices.map((invoice) => invoice.periodEnd?.toISOString()),
    ).to.deep.equal([CUTOFF.mar02, CUTOFF.mar09, CUTOFF.mar16])
    expect(invoices.map((invoice) => invoice.minutesActive)).to.deep.equal([
      60, 30, 15,
    ])
  }

  /**
   * The other half of catching up: an entry that syncs after its own week has
   * been billed is picked up by the next period rather than falling between
   * two invoices and never being billed at all.
   */
  @test()
  async run_lateSyncedTime_goesIntoTheNextPeriod() {
    const { project, worker } = await this.scheduled()

    await this.track(project, worker, CUTOFF.feb23, 60)
    await this.run(DUE.mar02)

    // The desktop tracker comes back online and uploads a bucket from the
    // week that has already been invoiced.
    await this.track(project, worker, Date.parse(CUTOFF.feb23) + 48 * HOUR, 25)

    const report = await this.run(DUE.mar09)

    expect(report.issued).to.equal(1)

    const invoices = await this.invoicesOf(project)

    expect(invoices).to.have.length(2)
    expect(invoices[0].minutesActive).to.equal(60)
    expect(invoices[0].periodEnd?.toISOString()).to.equal(CUTOFF.mar02)
    // The late entry, billed by the following period.
    expect(invoices[1].minutesActive).to.equal(25)
    expect(invoices[1].periodEnd?.toISOString()).to.equal(CUTOFF.mar09)
    expect(Number(invoices[1].lines?.length)).to.equal(1)
  }

  /**
   * A rate change at a period boundary changes what is billed after it and
   * nothing that was billed before it (DEC-04): each invoice froze its own
   * rate at issuance.
   */
  @test()
  async run_aRateChangeAtTheBoundary_leavesTheIssuedInvoiceAlone() {
    const { project, worker } = await this.scheduled()

    await this.track(project, worker, CUTOFF.feb23, 60)
    await this.run(DUE.mar02)

    project.rateHour = 90
    await runPromise(this.projectRepository.saveSingle(project))

    await this.track(project, worker, CUTOFF.mar02, 60)
    await this.run(DUE.mar09)

    const invoices = await this.invoicesOf(project)

    expect(invoices).to.have.length(2)
    expect(invoices[0].rateHourCents, 'the rate it was raised at').to.equal(
      6000,
    )
    expect(invoices[0].amountCents).to.equal(6000)
    expect(invoices[1].rateHourCents).to.equal(9000)
    expect(invoices[1].amountCents).to.equal(9000)
  }

  /** Nobody is enrolled by default: no consent, no invoice. */
  @test()
  async run_withoutConsent_issuesNothing() {
    const { project, worker } = await this.scheduled({ consent: false })

    await this.track(project, worker, CUTOFF.feb23, 60)

    const report = await this.run(DUE.mar02)

    expect(report.issuers).to.equal(0)
    expect(report.issued).to.equal(0)
    expect(await this.invoicesOf(project)).to.have.length(0)
  }

  /** Consent withdrawn stops the schedule from the next period on. */
  @test()
  async run_afterConsentIsWithdrawn_issuesNothingMore() {
    const { project, worker } = await this.scheduled()

    await this.track(project, worker, CUTOFF.feb23, 60)
    await this.run(DUE.mar02)

    project.invoiceCadenceConsent = InvoiceCadence.withConsent(
      project.invoiceCadenceConsent,
      worker,
      false,
      new Date(CUTOFF.mar02),
    )
    await runPromise(this.projectRepository.saveSingle(project))

    await this.track(project, worker, CUTOFF.mar02, 60)

    const report = await this.run(DUE.mar09)

    expect(report.issuers).to.equal(0)
    expect(await this.invoicesOf(project)).to.have.length(1)
  }

  /**
   * Consent is a record of an answer, not a role. Somebody taken off the
   * project keeps the record and stops being billed for.
   */
  @test()
  async run_forSomeoneNoLongerAWorker_issuesNothing() {
    const { project, worker } = await this.scheduled()

    await this.track(project, worker, CUTOFF.feb23, 60)

    project.workerAddresses = []
    await runPromise(this.projectRepository.saveSingle(project))

    const report = await this.run(DUE.mar02)

    expect(report.issuers).to.equal(0)
    expect(await this.invoicesOf(project)).to.have.length(0)
  }

  /** A project whose owner never stated a cadence is never touched. */
  @test()
  async run_skipsAProjectWithoutACadence() {
    const owner = await this.workerFixture.createPremiumUser()
    const project = await this.projectFixture.createPersonal(owner, 60)

    await this.track(project, owner, CUTOFF.feb23, 60)

    await this.run(DUE.mar02)

    expect(await this.invoicesOf(project)).to.have.length(0)
  }

  /**
   * The documented policy for the manual route: it stays, it is always
   * allowed, and it never collides with the schedule. A manual invoice takes
   * its entries out of the schedule's reach simply by billing them, and
   * carries no period, so the unique key never compares the two.
   */
  @test()
  async manualIssuance_staysAvailableAndTakesItsHoursOutOfTheSchedule() {
    const { project, worker } = await this.scheduled()

    await this.track(project, worker, CUTOFF.feb23, 60)

    const byHand = await runPromise(
      this.invoiceManager.ensureForProject(project, worker),
    )

    expect(byHand?.issuanceKind).to.equal(EInvoiceIssuanceKind.MANUAL)
    expect(byHand?.periodStart ?? null).to.equal(null)
    expect(byHand?.periodEnd ?? null).to.equal(null)

    const report = await this.run(DUE.mar02)

    expect(report.issued, 'the schedule found nothing left to bill').to.equal(0)
    expect(await this.invoicesOf(project)).to.have.length(1)

    // And a second manual invoice for new work is not blocked by the first.
    await this.track(project, worker, CUTOFF.mar02, 30)

    const second = await runPromise(
      this.invoiceManager.ensureForProject(project, worker),
    )

    expect(second?.id).to.not.equal(byHand?.id)
    expect(await this.invoicesOf(project)).to.have.length(2)
  }

  /**
   * The constraint itself, with the application's own guard taken out of the
   * picture: a second scheduled invoice for the same project, issuer and
   * period is refused by the database, which is what makes the schedule safe
   * against two processes rather than merely against two sequential calls.
   */
  @test()
  async scheduledPeriodKey_refusesASecondInvoiceForTheSamePeriod() {
    const { project, worker } = await this.scheduled()

    await this.track(project, worker, CUTOFF.feb23, 60)
    await this.run(DUE.mar02)

    const [issued] = await this.invoicesOf(project)
    const duplicate = new Invoice()

    duplicate.project = project
    duplicate.user = worker
    duplicate.fromAt = issued.fromAt
    duplicate.toAt = issued.toAt
    duplicate.amountCents = issued.amountCents
    duplicate.state = EInvoiceState.REQUESTED
    duplicate.issuanceKind = EInvoiceIssuanceKind.SCHEDULED
    duplicate.periodStart = issued.periodStart
    duplicate.periodEnd = issued.periodEnd

    const refusal = await runPromise(
      this.invoiceRepository.saveSingle(duplicate),
    ).then(
      () => null,
      (error: unknown) => error,
    )

    expect(refusal, 'the second row for one period').to.not.equal(null)
    expect(InvoiceRepository.isDuplicatePeriod(refusal)).to.equal(true)
    expect(await this.invoicesOf(project)).to.have.length(1)
  }

  /**
   * And the same key leaves manual invoices alone: they carry no period, and
   * a unique constraint never compares rows with nulls in them, so a person
   * can raise as many as they have work for.
   */
  @test()
  async scheduledPeriodKey_doesNotCompareManualInvoices() {
    const { project, worker } = await this.scheduled()

    await this.track(project, worker, CUTOFF.feb23, 30)

    const first = await runPromise(
      this.invoiceManager.ensureForProject(project, worker),
    )

    await this.track(project, worker, CUTOFF.mar02, 30)

    const second = await runPromise(
      this.invoiceManager.ensureForProject(project, worker),
    )

    expect(first?.id).to.not.equal(second?.id)
    expect(first?.periodEnd ?? null).to.equal(null)
    expect(second?.periodEnd ?? null).to.equal(null)
  }

  /** The timer is armed once and released on stop. */
  @test()
  schedulerTimer_armsOnceAndStops() {
    expect(this.scheduler.running).to.equal(false)

    this.scheduler.start(InvoiceScheduler.INTERVAL_MS)
    this.scheduler.start(InvoiceScheduler.INTERVAL_MS)

    expect(this.scheduler.running).to.equal(true)

    this.scheduler.stop()

    expect(this.scheduler.running).to.equal(false)
  }

  private run(now: Date) {
    return runPromise(this.scheduler.run(now))
  }

  /** A project with the Monday cadence and, by default, a consenting worker. */
  private async scheduled({ consent = true } = {}): Promise<{
    owner: User
    worker: User
    project: Project
  }> {
    const owner = await this.workerFixture.createPremiumUser()
    const worker = await this.workerFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    project.rateHour = 60
    project.workerAddresses = [worker.address]
    project.viewerAddresses = []
    project.invoiceCadence = [MONDAY_NY]
    project.invoiceCadenceConsent = consent
      ? InvoiceCadence.withConsent(
          null,
          worker,
          true,
          new Date(MONDAY_NY.effectiveFrom),
        )
      : null

    await runPromise(this.projectRepository.saveSingle(project))

    return { owner, worker, project }
  }

  /** One tracked slice starting at `from`, with every minute active. */
  private async track(
    project: Project,
    user: User,
    from: string | number,
    minutes: number,
  ) {
    const start = new Date(from)
    const entry = await this.timeFixture.create(
      project,
      start,
      new Date(start.getTime() + minutes * 60000),
      user,
    )

    entry.minutesActive = minutes

    return runPromise(this.timeRepository.saveSingle(entry))
  }

  /** This project's invoices, oldest period first. */
  private async invoicesOf(project: Project): Promise<Invoice[]> {
    const invoices = await runPromise(
      this.invoiceRepository.findBy({
        where: { project: { id: project.id } },
        relations: { user: true, project: true },
      }),
    )

    return invoices.sort(
      (left, right) =>
        Number(left.periodEnd ?? left.createdAt) -
        Number(right.periodEnd ?? right.createdAt),
    )
  }
}
