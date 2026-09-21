import axios from 'axios'
import { expect } from 'chai'
import { suite, test } from '@testdeck/mocha'
import moment from 'moment'

import { timeControllerGetTotals } from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'

type TotalsRow = {
  projectId: string
  minutes: number
  minutesActive: number
}

/**
 * Totals inside one window - a contract week, as the marketplace asks for
 * it. A week is a claim about a specific stretch of work, so which slice
 * falls in which week has to be decided the same way every time.
 */
@suite
export class TimeControllerTotalsTest extends BaseControllerTest {
  /**
   * A week of slices around `anchor`: one last week, two this week, one
   * that starts this week and runs into the next.
   *
   * Every boundary is derived from the single `anchor` instant, never from
   * a second clock read: a window whose ends came from two reads can fall
   * either side of a millisecond tick and drop the row it was meant to hold.
   */
  private async project(anchor: moment.Moment) {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user, 60)
    const slice = (startsAt: moment.Moment, minutes: number) =>
      this.timeFixture.create(
        project,
        startsAt.toDate(),
        startsAt.clone().add(minutes, 'minutes').toDate(),
        user,
      )

    const lastWeek = await slice(anchor.clone().subtract(6, 'days'), 30)
    const early = await slice(anchor.clone().add(1, 'hours'), 60)
    const late = await slice(anchor.clone().add(3, 'days'), 90)
    // Starts inside this week, ends inside the next: counted where it began.
    const spanning = await slice(
      anchor.clone().add(7, 'days').subtract(30, 'minutes'),
      120,
    )

    return { user, project, lastWeek, early, late, spanning }
  }

  private totals(
    token: string,
    projectId: string,
    query?: { fromAt?: number; toAt?: number },
  ) {
    return timeControllerGetTotals({
      client: this.apiClient(),
      path: { id: projectId as never },
      headers: { Authorization: token },
      query,
      throwOnError: true,
    })
  }

  @test
  async totals_countOnlyTheWeekAsked_forBothSides() {
    // One instant; every boundary below is derived from it.
    const weekStart = moment.utc().startOf('day').subtract(2, 'days')
    const { user, project } = await this.project(weekStart)
    const token = this.authenticator.getTokens(user).accessToken
    const seconds = (at: moment.Moment) => Math.floor(at.valueOf() / 1000)

    const thisWeek = await this.totals(token, project.id, {
      fromAt: seconds(weekStart),
      toAt: seconds(weekStart.clone().add(7, 'days')),
    })
    const lastWeek = await this.totals(token, project.id, {
      fromAt: seconds(weekStart.clone().subtract(7, 'days')),
      toAt: seconds(weekStart),
    })
    const everything = await this.totals(token, project.id)

    const [thisRow] = thisWeek.data as unknown as TotalsRow[]
    const [lastRow] = lastWeek.data as unknown as TotalsRow[]
    const [allRow] = everything.data as unknown as TotalsRow[]

    // 60 + 90 + 120: the spanning slice belongs to the week it started in.
    expect(thisRow.minutes).to.be.eq(270)
    expect(lastRow.minutes).to.be.eq(30)
    // The weeks add up to the whole, which is what counting a slice in
    // exactly one week buys.
    expect(allRow.minutes).to.be.eq(300)
  }

  /** A window with nothing in it answers zero, not a missing project. */
  @test
  async totals_forAWeekWithNoWork_areZero() {
    const weekStart = moment.utc().startOf('day').subtract(2, 'days')
    const { user, project } = await this.project(weekStart)
    const token = this.authenticator.getTokens(user).accessToken
    const quiet = weekStart.clone().subtract(60, 'days')

    const res = await this.totals(token, project.id, {
      fromAt: Math.floor(quiet.valueOf() / 1000),
      toAt: Math.floor(quiet.clone().add(7, 'days').valueOf() / 1000),
    })

    expect(res.status).to.be.eq(200)
    expect(res.data).to.have.length(0)
  }

  /** One end alone is a half-open window, not an error. */
  @test
  async totals_acceptOneBoundaryOnItsOwn() {
    const weekStart = moment.utc().startOf('day').subtract(2, 'days')
    const { user, project } = await this.project(weekStart)
    const token = this.authenticator.getTokens(user).accessToken

    const since = await this.totals(token, project.id, {
      fromAt: Math.floor(weekStart.valueOf() / 1000),
    })
    const until = await this.totals(token, project.id, {
      toAt: Math.floor(weekStart.valueOf() / 1000),
    })

    const [sinceRow] = since.data as unknown as TotalsRow[]
    const [untilRow] = until.data as unknown as TotalsRow[]

    expect(sinceRow.minutes).to.be.eq(270)
    expect(untilRow.minutes).to.be.eq(30)
  }

  /**
   * The window narrows what is counted; it never widens who may count. A
   * stranger asking for one week is refused exactly as they are refused the
   * whole project.
   */
  @test
  async totals_forAWeek_areStillRefusedToAStranger() {
    const weekStart = moment.utc().startOf('day').subtract(2, 'days')
    const { project } = await this.project(weekStart)
    const outsider = await this.userFixture.createUser()

    let error: unknown

    try {
      await this.totals(
        this.authenticator.getTokens(outsider).accessToken,
        project.id,
        {
          fromAt: Math.floor(weekStart.valueOf() / 1000),
          toAt: Math.floor(weekStart.clone().add(7, 'days').valueOf() / 1000),
        },
      )
    } catch (thrown: unknown) {
      error = thrown
    }

    if (!axios.isAxiosError(error)) throw error

    expect(error.response?.status).to.be.eq(403)
  }
}
