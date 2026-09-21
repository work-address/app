import axios from 'axios'
import { expect } from 'chai'
import { suite, test } from '@testdeck/mocha'
import moment from 'moment'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { Project } from '@/entity/project'
import { User } from '@/entity/user'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeRepository } from '@/repository/time-repository'
import { runPromise } from '@/service/effect-bridge'

type TotalsRow = { minutes: number; minutesOverCap?: number }

/** One row covers at most an hour (TimeBounds), so an hour is the unit here. */
const SLICE_MINUTES = 60

/**
 * The weekly hour cap a hire was agreed under: flagged, never refused
 * (SPEC, WP-51). The hours were worked, and a tracker that silently dropped
 * them would destroy the only record of work someone actually did - so the
 * rows are stored, marked, and reported to both sides as an overage.
 */
@suite
export class TimeManagerWeeklyCapTest extends BaseControllerTest {
  protected projectRepository: ProjectRepository
  protected timeRepository: TimeRepository

  constructor() {
    super()

    this.projectRepository = this.container.get('ProjectRepository')
    this.timeRepository = this.container.get('TimeRepository')
  }

  /**
   * A capped project whose weekly period opens at `weekStartsAt`, with one
   * worker who can track against it - a marketplace hire, in other words.
   */
  private async capped(weeklyLimit: number | null, weekStartsAt: Date) {
    const client = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createHired(client, worker, 40)

    project.weeklyLimit = weeklyLimit
    project.weeklyPeriodStartsAt = weekStartsAt

    await runPromise(this.projectRepository.saveSingle(project))

    return {
      worker,
      project,
      token: this.authenticator.getTokens(worker).accessToken,
    }
  }

  /**
   * `hours` consecutive hour-long slices, the first starting `fromHour`
   * hours into the week. One request, as a tracker syncs a batch.
   *
   * Every instant is derived from the single anchor the week itself is
   * built on, never from a second clock read.
   */
  private post(
    token: string,
    project: Project,
    weekStartsAt: Date,
    fromHour: number,
    hours: number,
  ) {
    const body = Array.from({ length: hours }, (_, offset) => {
      const startsAt = moment.utc(weekStartsAt).add(fromHour + offset, 'hours')

      return {
        fromIndex: (fromHour + offset) * SLICE_MINUTES,
        toIndex: (fromHour + offset + 1) * SLICE_MINUTES,
        note: `hour ${fromHour + offset}`,
        keyboardKeys: 1,
        minutesActive: SLICE_MINUTES,
        mouseKeys: 1,
        mouseDistance: 1,
        fromAt: startsAt.toISOString(),
        toAt: startsAt.clone().add(SLICE_MINUTES, 'minutes').toISOString(),
        projectId: project.id,
      }
    })

    return axios.post(`${this.url}/api/time`, body, {
      headers: { Authorization: token },
      validateStatus: () => true,
    })
  }

  private totals(
    token: string,
    projectId: string,
    window?: { fromAt: Date; toAt: Date },
  ) {
    const seconds = (at: Date) => Math.floor(at.getTime() / 1000)
    const query = window
      ? `?fromAt=${seconds(window.fromAt)}&toAt=${seconds(window.toAt)}`
      : ''

    return axios.get(
      `${this.url}/api/time/totals/${projectId}/project${query}`,
      { headers: { Authorization: token }, validateStatus: () => true },
    )
  }

  /** The flag as stored, by entry id, in the order the ids were given. */
  private async flags(ids: string[], worker: User) {
    const rows = await runPromise(
      this.timeRepository.findByIdsAsAuthor(ids, worker),
    )
    const byId = new Map(
      rows.map((row) => [row.id, Boolean(row.overWeeklyCap)]),
    )

    return new Map(ids.map((id) => [id, byId.get(id) ?? false]))
  }

  /**
   * The package's own case: a 10-hour cap and 11 hours posted. Every hour is
   * stored, the eleventh is flagged, and the week reports 60 minutes over.
   */
  @test
  async elevenHoursAgainstATenHourCap_areKeptAndFlagged() {
    // A week that has already begun, so every slice is in the past.
    const weekStartsAt = moment.utc().startOf('day').subtract(2, 'days')
    const anchor = weekStartsAt.toDate()
    const { worker, project, token } = await this.capped(10, anchor)

    const res = await this.post(token, project, anchor, 0, 11)
    const rows = res.data as { id: string; error?: unknown }[]
    const flags = await this.flags(
      rows.map((row) => row.id),
      worker,
    )
    const totals = await this.totals(token, project.id, {
      fromAt: anchor,
      toAt: weekStartsAt.clone().add(7, 'days').toDate(),
    })
    const [row] = totals.data as TotalsRow[]

    // Nothing was refused: eleven rows, none carrying an error.
    expect(rows).to.have.length(11)
    expect(rows.filter((entry) => entry.error)).to.have.length(0)
    // The first ten are inside the cap; the eleventh is what crosses it.
    expect([...flags.values()].slice(0, 10)).to.deep.eq(
      Array.from({ length: 10 }, () => false),
    )
    expect(flags.get(rows[10].id)).to.be.true
    expect(row.minutes).to.be.eq(660)
    expect(row.minutesOverCap).to.be.eq(60)
  }

  /** The cap resets: the next week starts from nothing. */
  @test
  async theNextWeekStartsUnderTheCapAgain() {
    const weekStartsAt = moment.utc().startOf('day').subtract(9, 'days')
    const anchor = weekStartsAt.toDate()
    const { worker, project, token } = await this.capped(10, anchor)

    await this.post(token, project, anchor, 0, 11)

    const second = weekStartsAt.clone().add(7, 'days')
    const res = await this.post(token, project, second.toDate(), 0, 2)
    const rows = res.data as { id: string; error?: unknown }[]
    const flags = await this.flags(
      rows.map((row) => row.id),
      worker,
    )
    const totals = await this.totals(token, project.id, {
      fromAt: second.toDate(),
      toAt: second.clone().add(7, 'days').toDate(),
    })
    const [row] = totals.data as TotalsRow[]

    expect(rows.filter((entry) => entry.error)).to.have.length(0)
    expect([...flags.values()]).to.deep.eq([false, false])
    expect(row.minutes).to.be.eq(120)
    expect(row.minutesOverCap).to.be.eq(0)
  }

  /**
   * A project with no cap is never flagged, and its totals carry no overage
   * at all - absent, not zero: the two are different claims.
   */
  @test
  async anUncappedProjectIsNeverOverAnything() {
    const weekStartsAt = moment.utc().startOf('day').subtract(2, 'days')
    const anchor = weekStartsAt.toDate()
    const { worker, project, token } = await this.capped(null, anchor)

    const res = await this.post(token, project, anchor, 0, 40)
    const rows = res.data as { id: string }[]
    const flags = await this.flags(
      rows.map((row) => row.id),
      worker,
    )
    const totals = await this.totals(token, project.id, {
      fromAt: anchor,
      toAt: weekStartsAt.clone().add(7, 'days').toDate(),
    })
    const [totalsRow] = totals.data as TotalsRow[]

    expect([...flags.values()].some(Boolean)).to.be.false
    expect(totalsRow.minutes).to.be.eq(2400)
    expect(totalsRow).to.not.have.property('minutesOverCap')
  }

  /**
   * Without a window there is no overage to report: a cap is a claim about
   * one week, and one measured across a project's whole history would be
   * meaningless - and alarming.
   */
  @test
  async theWholeHistoryReportsNoOverage() {
    const weekStartsAt = moment.utc().startOf('day').subtract(2, 'days')
    const anchor = weekStartsAt.toDate()
    const { project, token } = await this.capped(10, anchor)

    await this.post(token, project, anchor, 0, 11)

    const totals = await this.totals(token, project.id)
    const [row] = totals.data as TotalsRow[]

    expect(row.minutes).to.be.eq(660)
    expect(row).to.not.have.property('minutesOverCap')
  }

  /**
   * Re-uploading the same slices must not count them twice, or a tracker
   * that retries would flag a week well inside its cap.
   */
  @test
  async aReUploadOfTheSameSlicesIsNotCountedTwice() {
    const weekStartsAt = moment.utc().startOf('day').subtract(2, 'days')
    const anchor = weekStartsAt.toDate()
    const { worker, project, token } = await this.capped(10, anchor)

    await this.post(token, project, anchor, 0, 9)

    const again = await this.post(token, project, anchor, 0, 9)
    const rows = again.data as { id: string }[]
    const flags = await this.flags(
      rows.map((row) => row.id),
      worker,
    )
    const totals = await this.totals(token, project.id, {
      fromAt: anchor,
      toAt: weekStartsAt.clone().add(7, 'days').toDate(),
    })
    const [totalsRow] = totals.data as TotalsRow[]

    expect([...flags.values()].some(Boolean)).to.be.false
    expect(totalsRow.minutes).to.be.eq(540)
    expect(totalsRow.minutesOverCap).to.be.eq(0)
  }
}
