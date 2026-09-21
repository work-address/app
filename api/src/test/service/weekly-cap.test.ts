import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'

import { Project } from '@/entity/project'
import { WeeklyCap } from '@/service/weekly-cap'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Where a project's weekly periods begin and what "over the cap" means.
 *
 * Every instant here is fixed rather than read from the clock, and every
 * span is derived from one instant.
 */
@suite()
export class WeeklyCapTest {
  private project(fields: Partial<Project>): Project {
    return Object.assign(new Project(), {
      createdAt: new Date('2026-03-02T09:00:00.000Z'),
      ...fields,
    })
  }

  @test()
  aCapInHoursIsMeasuredInMinutes() {
    expect(WeeklyCap.minutes(this.project({ weeklyLimit: 20 }))).to.be.eq(1200)
  }

  /** No cap is not a cap of zero, and the two must not read alike. */
  @test()
  aProjectWithoutACapHasNone() {
    const uncapped = this.project({})

    expect(WeeklyCap.minutes(uncapped)).to.be.null
    expect(WeeklyCap.overage(uncapped, 100_000)).to.be.null
  }

  /**
   * The periods run from the contract's own start, which the hire sends -
   * not from a Monday, and not from whenever the project row happened to be
   * written.
   */
  @test()
  periodsRunFromTheStartTheHireNamed() {
    const startsAt = new Date('2026-03-05T00:00:00.000Z')
    const project = this.project({
      weeklyLimit: 20,
      weeklyPeriodStartsAt: startsAt,
    })

    const first = WeeklyCap.periodAt(project, startsAt)
    const stillFirst = WeeklyCap.periodAt(
      project,
      new Date(startsAt.getTime() + WEEK_MS - 1),
    )
    const second = WeeklyCap.periodAt(
      project,
      new Date(startsAt.getTime() + WEEK_MS),
    )

    expect(first.fromAt?.toISOString()).to.be.eq(startsAt.toISOString())
    expect(stillFirst.fromAt?.getTime()).to.be.eq(first.fromAt?.getTime())
    // Half-open: the next period begins exactly where this one ends.
    expect(second.fromAt?.getTime()).to.be.eq(first.toAt?.getTime())
  }

  /** A project made here directly has only its own creation to start from. */
  @test()
  withoutAHiresStart_periodsRunFromTheProjectItself() {
    const project = this.project({ weeklyLimit: 10 })

    expect(
      WeeklyCap.periodAt(
        project,
        new Date('2026-03-04T12:00:00.000Z'),
      ).fromAt?.toISOString(),
    ).to.be.eq('2026-03-02T09:00:00.000Z')
  }

  /**
   * Work backdated before the start still lands in one week's worth of
   * period rather than in the whole of history.
   */
  @test()
  workBeforeTheStartStillLandsInOneWeek() {
    const startsAt = new Date('2026-03-05T00:00:00.000Z')
    const project = this.project({
      weeklyLimit: 20,
      weeklyPeriodStartsAt: startsAt,
    })
    const period = WeeklyCap.periodAt(
      project,
      new Date(startsAt.getTime() - 1000),
    )

    expect(period.toAt?.getTime()).to.be.eq(startsAt.getTime())
    expect(
      (period.toAt?.getTime() ?? 0) - (period.fromAt?.getTime() ?? 0),
    ).to.be.eq(WEEK_MS)
  }

  @test()
  theOverageIsWhatIsBeyondTheCap() {
    const project = this.project({ weeklyLimit: 10 })

    expect(WeeklyCap.overage(project, 600)).to.be.eq(0)
    expect(WeeklyCap.overage(project, 660)).to.be.eq(60)
    // Under the cap is zero over it, never a negative.
    expect(WeeklyCap.overage(project, 60)).to.be.eq(0)
  }
}
