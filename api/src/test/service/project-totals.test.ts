import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import moment from 'moment'

import { Project } from '@/entity/project'
import { Time } from '@/entity/time'
import { User } from '@/entity/user'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { runPromise } from '@/service/effect-bridge'
import { InvoiceManager } from '@/service/invoice-manager'
import { ProjectRepository } from '@/repository/project-repository'
import { IProjectFigures, ProjectTotals } from '@/service/project-totals'
import { TimeManager } from '@/service/time-manager'
import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { TimeFixture } from '@/test/fixture/time-fixture'
import { UserFixture } from '@/test/fixture/user-fixture'

const HOUR = 3600
const RATE = 60
const CENTS_AN_HOUR = 6000

/**
 * Which figures each role reads for a project, on real Postgres. The worker's
 * hour is on no invoice; a colleague's and the owner's show nothing crosses
 * from one person to another.
 */
@suite()
export class ProjectTotalsTest extends AbstractDatabaseIntegration {
  private totals: ProjectTotals
  private users: UserFixture
  private projects: ProjectFixture
  private times: TimeFixture
  private invoices: InvoiceManager
  private timeManager: TimeManager

  constructor() {
    super()
    this.totals = this.container.get('ProjectTotals')
    this.users = this.container.get('UserFixture')
    this.projects = this.container.get('ProjectFixture')
    this.times = this.container.get('TimeFixture')
    this.invoices = this.container.get('InvoiceManager')
    this.timeManager = this.container.get('TimeManager')
  }

  private async world() {
    const owner = await this.users.createPremiumUser()
    const worker = await this.users.createUser()
    const colleague = await this.users.createUser()
    const viewer = await this.users.createUser()
    const outsider = await this.users.createUser()
    const project = await this.projects.createPersonal(owner, RATE)
    project.user = owner
    project.workerAddresses = [worker.address, colleague.address]
    project.viewerAddresses = [viewer.address]
    await this.conn.getRepository(Project).save(project)

    return { owner, worker, colleague, viewer, outsider, project }
  }

  private cursor = 0

  /** An hour of `author`'s time, each call an hour earlier than the last. */
  private async hour(
    project: Project,
    author: User,
    fields: Partial<Time> = {},
  ): Promise<Time> {
    this.cursor += 1
    const to = moment.utc().subtract(this.cursor, 'hours')
    const time = await this.times.create(
      project,
      to.clone().subtract(1, 'hour').toDate(),
      to.toDate(),
      author,
    )
    return this.conn.getRepository(Time).save(Object.assign(time, fields))
  }

  private async one(project: Project, reader: User): Promise<IProjectFigures> {
    const [row] = await this.totals.read([project], reader)
    return row
  }

  private async billed(project: Project, author: User, times: Time[]) {
    return runPromise(
      this.invoices.createFromTimeIds(
        project,
        author,
        times.map((time) => time.id),
      ),
    )
  }

  @test()
  async eachRoleReadsItsOwnFigures() {
    const { owner, worker, colleague, viewer, outsider, project } =
      await this.world()
    await this.hour(project, owner)
    await this.hour(project, worker, { isPaid: true })
    await this.hour(project, worker)
    await this.hour(project, colleague)

    expect(await this.one(project, owner)).to.include({
      trackedSeconds: 4 * HOUR,
      paidSeconds: HOUR,
      unpaidSeconds: 3 * HOUR,
      rateHour: RATE,
      earnedCents: 4 * CENTS_AN_HOUR,
      paidCents: CENTS_AN_HOUR,
      unpaidCents: 3 * CENTS_AN_HOUR,
    })
    expect(await this.one(project, worker)).to.include({
      trackedSeconds: 2 * HOUR,
      paidSeconds: HOUR,
      unpaidSeconds: HOUR,
      rateHour: RATE,
      earnedCents: 2 * CENTS_AN_HOUR,
      paidCents: CENTS_AN_HOUR,
      unpaidCents: CENTS_AN_HOUR,
    })
    expect(await this.one(project, colleague)).to.include({
      trackedSeconds: HOUR,
      paidCents: 0,
    })
    // Omitted, not nulled: these are the only keys a viewer's row has.
    expect(await this.one(project, viewer)).to.deep.equal({
      projectId: project.id,
      trackedSeconds: 4 * HOUR,
    })
    expect(await this.totals.read([project], outsider)).to.deep.equal([])
  }

  @test()
  async bothRoutesAnswerTheSameFigures() {
    const { worker, viewer, project } = await this.world()
    await this.hour(project, worker, { isPaid: true })

    const [row] = await this.totals.readAllTime(project, worker)
    expect(row).to.deep.include({
      projectId: project.id,
      minutes: 60,
      minutesPaid: 60,
      minutesUnpaid: 0,
      rateHour: RATE,
      earnedCents: CENTS_AN_HOUR,
      paidCents: CENTS_AN_HOUR,
      unpaidCents: 0,
    })

    const [viewed] = await this.totals.readAllTime(project, viewer)
    // Undefined drops out of the response; nothing is sent as null.
    expect(JSON.parse(JSON.stringify(viewed))).to.deep.equal({
      projectId: project.id,
      minutes: 60,
    })
  }

  @test()
  async aBackwardsEntryCountsAsNothing() {
    const { worker, project } = await this.world()
    await this.hour(project, worker)
    const to = moment.utc().subtract(1, 'day')
    await this.times.create(
      project,
      to.toDate(),
      to.clone().subtract(1, 'hour').toDate(),
      worker,
    )

    expect(await this.one(project, worker)).to.include({
      trackedSeconds: HOUR,
      earnedCents: CENTS_AN_HOUR,
    })
  }

  @test()
  async paidTimeIsEveryMarkedMinuteAndPaidMoneyPrefersTheInvoice() {
    const { worker, project } = await this.world()
    const settled = await this.hour(project, worker)
    const unmarked = await this.hour(project, worker)
    const invoice = await this.billed(project, worker, [settled, unmarked])
    await runPromise(this.invoices.markPaid(invoice, worker))
    // The project's rate moved after billing: the invoice keeps its amount.
    project.rateHour = RATE * 2
    await this.conn.getRepository(Project).save(project)

    // Un-marked by hand on a paid invoice: still counts through the invoice.
    await runPromise(
      this.timeManager.setIsPaidMany([unmarked.id], false, worker),
    )
    // Marked by hand on an unpaid invoice: counts as minutes at today's rate.
    const requested = await this.hour(project, worker)
    await this.billed(project, worker, [requested])
    await runPromise(
      this.timeManager.setIsPaidMany([requested.id], true, worker),
    )
    // Marked by hand on no invoice: the same.
    await this.hour(project, worker, { isPaid: true })

    const row = await this.one(project, worker)

    expect(row.paidSeconds, 'settled, requested, loose').to.equal(3 * HOUR)
    expect(row.unpaidSeconds, 'unmarked').to.equal(HOUR)
    expect(row.paidCents).to.equal(
      2 * CENTS_AN_HOUR + 2 * 2 * CENTS_AN_HOUR,
      'the invoice as billed, and two hours at the new rate',
    )
  }

  @test()
  async aPaidInvoiceCountsForItsIssuerAndTheOwnerOnly() {
    const { owner, worker, colleague, viewer, project } = await this.world()
    const theirs = await this.hour(project, worker)
    const invoice = await this.billed(project, worker, [theirs])
    await runPromise(this.invoices.markPaid(invoice, worker))
    await this.hour(project, colleague)

    expect((await this.one(project, worker)).paidCents).to.equal(CENTS_AN_HOUR)
    expect((await this.one(project, colleague)).paidCents).to.equal(0)
    expect((await this.one(project, owner)).paidCents).to.equal(CENTS_AN_HOUR)
    expect(await this.one(project, viewer)).to.not.have.property('paidCents')
  }

  @test()
  async aRequestedOrRejectedInvoiceCountsForNothing() {
    const { owner, worker, project } = await this.world()
    const requested = await this.hour(project, worker)
    await this.billed(project, worker, [requested])
    const rejected = await this.hour(project, worker)
    const invoice = await this.billed(project, worker, [rejected])
    await runPromise(this.invoices.reject(invoice, owner, 'wrong hours'))

    expect((await this.one(project, worker)).paidCents).to.equal(0)
  }

  /** Agent time has no minutes here: its money arrives on the invoice. */
  @test()
  async agentLinesCountThroughTheInvoiceAmount() {
    const { worker, project } = await this.world()
    const theirs = await this.hour(project, worker)
    const invoice = await this.billed(project, worker, [theirs])
    invoice.amountCents = CENTS_AN_HOUR + 1234
    await runPromise(
      this.container
        .get<InvoiceRepository>('InvoiceRepository')
        .saveSingle(invoice),
    )
    await runPromise(this.invoices.markPaid(invoice, worker))

    expect(await this.one(project, worker)).to.include({
      trackedSeconds: HOUR,
      paidCents: CENTS_AN_HOUR + 1234,
    })
  }

  @test()
  async aSpanCutsEntriesAndInvoicesByWhenTheyStart() {
    const { owner, worker, project } = await this.world()
    await this.hour(project, worker)
    const old = moment.utc().subtract(10, 'days')
    const outside = await this.times.create(
      project,
      old.toDate(),
      old.clone().add(1, 'hour').toDate(),
      worker,
    )
    await runPromise(
      this.invoices.markPaid(
        await this.billed(project, worker, [outside]),
        worker,
      ),
    )
    const span = { from: moment.utc().subtract(2, 'days').toDate() }

    const [recent] = await this.totals.read([project], owner, span)
    expect(recent).to.include({ trackedSeconds: HOUR, paidCents: 0 })

    const [all] = await this.totals.read([project], owner)
    expect(all).to.include({
      trackedSeconds: 2 * HOUR,
      paidCents: CENTS_AN_HOUR,
    })
  }

  @test()
  async thePeopleFilterCutsEntriesAndInvoices() {
    const { owner, worker, colleague, project } = await this.world()
    await this.hour(project, colleague)
    const theirs = await this.hour(project, worker)
    await runPromise(
      this.invoices.markPaid(
        await this.billed(project, worker, [theirs]),
        worker,
      ),
    )

    const [row] = await this.totals.read([project], owner, {
      userIds: [colleague.id],
    })
    expect(row).to.include({ trackedSeconds: HOUR, paidCents: 0 })
  }

  @test()
  async detailStaysOutUntilTheOwnerMaySeeIt() {
    const { owner, worker, project } = await this.world()
    project.reviewWindowHours = 24
    await this.conn.getRepository(Project).save(project)
    await this.hour(project, worker, {
      minutesActive: 30,
      keyboardKeys: 7,
    })

    expect(await this.one(project, worker)).to.include({
      activeSeconds: 30 * 60,
      keyboardKeys: 7,
    })
    expect(await this.one(project, owner)).to.include({
      trackedSeconds: HOUR,
      activeSeconds: 0,
      keyboardKeys: 0,
    })
  }

  /** SPEC.md: time is the only thing a viewer reads off a project. */
  @test()
  async aViewersProjectReadCarriesTheirRoleAndNoRate() {
    const { owner, worker, viewer, project } = await this.world()
    const repository =
      this.container.get<ProjectRepository>('ProjectRepository')
    const read = (user: User) =>
      runPromise(repository.findProjectWithAccessOrFail(project, user))

    expect((await read(owner)).role).to.equal('owner')
    expect(Number((await read(owner)).rateHour)).to.equal(RATE)
    expect((await read(worker)).role).to.equal('worker')
    expect(Number((await read(worker)).rateHour)).to.equal(RATE)
    expect((await read(viewer)).role).to.equal('viewer')
    expect(await read(viewer)).to.not.have.property('rateHour')

    const [listed] = await runPromise(
      repository.findAndCountAccessibleBy(
        { filter: {}, sort: {}, page: 0 } as never,
        viewer,
      ),
    )
    expect(listed[0].role).to.equal('viewer')
    expect(listed[0]).to.not.have.property('rateHour')
  }

  /** A viewer cannot read the rate back through which projects match. */
  @test()
  async aViewerCannotFilterByRate() {
    const { owner, viewer, project } = await this.world()
    const repository =
      this.container.get<ProjectRepository>('ProjectRepository')
    const search = (user: User) =>
      runPromise(
        repository.findAndCountAccessibleBy(
          {
            filter: { rateHourFrom: RATE, projectId: project.id },
            sort: {},
            page: 0,
          } as never,
          user,
        ),
      )

    expect((await search(owner))[1]).to.equal(1)
    expect((await search(viewer))[1]).to.equal(0)
  }
}
