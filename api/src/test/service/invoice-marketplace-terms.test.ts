import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import moment from 'moment'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { Project } from '@/entity/project'
import { User } from '@/entity/user'
import { EProjectState } from '@/model/project'
import { InvoiceManager } from '@/service/invoice-manager'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeFixture } from '@/test/fixture/time-fixture'
import { TimeRepository } from '@/repository/time-repository'
import { UserFixture } from '@/test/fixture/user-fixture'
import { runPromise } from '@/service/effect-bridge'

/**
 * Every way an invoice is raised honours an amended marketplace rate from
 * the date it was agreed: never one invoice across the change, never the
 * new rate for hours worked before it.
 */
@suite()
export class InvoiceMarketplaceTermsTest extends AbstractDatabaseIntegration {
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

  /**
   * A project hired at 45 an hour whose rate became 60 an hour ago, with an
   * hour worked before the change and half an hour after it. One clock
   * read; every instant is derived from it.
   */
  private async amended() {
    const now = moment.utc()
    const change = now.clone().subtract(1, 'hour')
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    project.rateHour = 60
    project.marketplaceTerms = [
      {
        version: 1,
        effectiveFrom: null,
        rateHour: 45,
        weeklyLimit: null,
        trackScreenshots: false,
        trackProcesses: false,
      },
      {
        version: 2,
        effectiveFrom: change.toISOString(),
        rateHour: 60,
        weeklyLimit: null,
        trackScreenshots: false,
        trackProcesses: false,
      },
    ]
    await runPromise(this.projectRepository.saveSingle(project))

    const before = await this.track(
      project,
      owner,
      now.clone().subtract(3, 'hours'),
      60,
    )
    const after = await this.track(
      project,
      owner,
      now.clone().subtract(30, 'minutes'),
      30,
    )

    return { owner, project, now, change, before, after }
  }

  private async track(
    project: Project,
    user: User,
    from: moment.Moment,
    minutes: number,
  ) {
    const entry = await this.timeFixture.create(
      project,
      from.toDate(),
      from.clone().add(minutes, 'minutes').toDate(),
      user,
    )

    entry.minutesActive = minutes
    await runPromise(this.timeRepository.saveSingle(entry))

    return entry
  }

  /** A range across the change bills up to it, at the rate agreed then. */
  @test()
  async aRange_billsUpToTheChange_atTheEarlierRate() {
    const { owner, project, now, change } = await this.amended()

    const invoice = await runPromise(
      this.invoiceManager.create(
        {
          fromUnix: now.clone().subtract(1, 'day').valueOf(),
          toUnix: now.valueOf(),
        },
        project,
        owner,
      ),
    )

    expect(invoice.rateHourCents).to.eq(4500)
    expect(invoice.amountCents).to.eq(4500)
    expect(invoice.minutesActive).to.eq(60)
    expect(new Date(invoice.toAt).toISOString()).to.eq(change.toISOString())
  }

  /** A hand-picked selection across the change is refused, not split. */
  @test()
  async aSelection_acrossTheChange_isRefused() {
    const { owner, project, before, after } = await this.amended()
    let error: unknown

    try {
      await runPromise(
        this.invoiceManager.createFromTimeIds(project, owner, [
          before.id,
          after.id,
        ]),
      )
    } catch (caught: unknown) {
      error = caught
    }

    const onlyAfter = await runPromise(
      this.invoiceManager.createFromTimeIds(project, owner, [after.id]),
    )

    expect((error as { httpCode?: number })?.httpCode).to.eq(400)
    expect(onlyAfter.rateHourCents).to.eq(6000)
    expect(onlyAfter.amountCents).to.eq(3000)
  }

  /**
   * The schedule bills the earlier hours in this period and the later ones
   * in the next, each at its own rate - late time moving forward, as ever.
   */
  @test()
  async theSchedule_billsEachSideOfTheChangeAtItsOwnRate() {
    const { owner, project, now } = await this.amended()
    const period = (end: moment.Moment) => ({
      start: end.clone().subtract(7, 'days').toISOString(),
      end: end.toISOString(),
      issueAt: end.toISOString(),
    })

    const first = await runPromise(
      this.invoiceManager.issueForPeriod(project, owner, period(now)),
    )
    const second = await runPromise(
      this.invoiceManager.issueForPeriod(
        project,
        owner,
        period(now.clone().add(7, 'days')),
      ),
    )

    expect(first.invoice?.rateHourCents).to.eq(4500)
    expect(first.invoice?.amountCents).to.eq(4500)
    expect(second.invoice?.rateHourCents).to.eq(6000)
    expect(second.invoice?.amountCents).to.eq(3000)
  }
}
