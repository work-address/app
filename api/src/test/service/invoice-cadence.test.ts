import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import moment from 'moment-timezone'

import { IInvoiceCadenceVersion } from '@/model/project'
import { InvoiceCadence } from '@/service/invoice-cadence'

const HOUR = 3600000

/**
 * The cadence arithmetic, with the daylight-saving cases that make it worth
 * having: a cutoff is a reading of a wall clock in a named zone, so the week
 * between two of them is 167, 168 or 169 hours depending on the calendar.
 *
 * Every instant here is fixed rather than taken from the clock, and any span
 * asserted is derived from one instant, never from two separate reads.
 */
@suite()
export class InvoiceCadenceTest {
  /** Mondays at 09:00 New York time, from the start of 2026. */
  private static readonly NY_MONDAY: IInvoiceCadenceVersion = {
    weekday: 1,
    timezone: 'America/New_York',
    cutoffLocal: '09:00',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    finalizationDelayHours: 24,
  }

  /** The same rule, starting late enough to bound the catch-up walk. */
  private static readonly FROM_MAY_26: IInvoiceCadenceVersion = {
    ...InvoiceCadenceTest.NY_MONDAY,
    effectiveFrom: '2026-05-26T00:00:00.000Z',
  }

  private static hoursBetween(from: Date, to: Date): number {
    return (to.getTime() - from.getTime()) / HOUR
  }

  private static localReading(at: Date, timezone: string): string {
    return moment.tz(at, timezone).format('YYYY-MM-DD HH:mm')
  }

  /**
   * The case the whole class exists for. The United States springs forward on
   * Sunday 8 March 2026, so the Monday either side of it is 09:00 on the wall
   * both times and 167 hours apart.
   */
  @test()
  nextCutoff_acrossASpringForward_isAWeekOf167Hours() {
    const before = InvoiceCadence.nextCutoffAfter(
      InvoiceCadenceTest.NY_MONDAY,
      new Date('2026-03-01T00:00:00.000Z'),
    )
    const after = InvoiceCadence.nextCutoffAfter(
      InvoiceCadenceTest.NY_MONDAY,
      before,
    )

    expect(
      InvoiceCadenceTest.localReading(before, 'America/New_York'),
    ).to.equal('2026-03-02 09:00')
    expect(InvoiceCadenceTest.localReading(after, 'America/New_York')).to.equal(
      '2026-03-09 09:00',
    )
    // Standard time, then daylight time: 14:00Z, then 13:00Z.
    expect(before.toISOString()).to.equal('2026-03-02T14:00:00.000Z')
    expect(after.toISOString()).to.equal('2026-03-09T13:00:00.000Z')
    expect(InvoiceCadenceTest.hoursBetween(before, after)).to.equal(167)
  }

  /** And 169 hours the other way, when the clocks go back. */
  @test()
  nextCutoff_acrossAnAutumnBack_isAWeekOf169Hours() {
    const before = InvoiceCadence.nextCutoffAfter(
      InvoiceCadenceTest.NY_MONDAY,
      new Date('2026-10-25T00:00:00.000Z'),
    )
    const after = InvoiceCadence.nextCutoffAfter(
      InvoiceCadenceTest.NY_MONDAY,
      before,
    )

    expect(
      InvoiceCadenceTest.localReading(before, 'America/New_York'),
    ).to.equal('2026-10-26 09:00')
    expect(InvoiceCadenceTest.localReading(after, 'America/New_York')).to.equal(
      '2026-11-02 09:00',
    )
    expect(InvoiceCadenceTest.hoursBetween(before, after)).to.equal(169)
  }

  /** A week with no transition in it is the plain 168. */
  @test()
  nextCutoff_inAnOrdinaryWeek_is168Hours() {
    const before = InvoiceCadence.nextCutoffAfter(
      InvoiceCadenceTest.NY_MONDAY,
      new Date('2026-06-01T00:00:00.000Z'),
    )
    const after = InvoiceCadence.nextCutoffAfter(
      InvoiceCadenceTest.NY_MONDAY,
      before,
    )

    expect(InvoiceCadenceTest.hoursBetween(before, after)).to.equal(168)
  }

  /** A cutoff exactly now belongs to the period that just closed. */
  @test()
  nextCutoff_standingOnACutoff_isTheOneAfterIt() {
    const cutoff = new Date('2026-06-01T13:00:00.000Z')

    expect(
      InvoiceCadenceTest.localReading(cutoff, 'America/New_York'),
    ).to.equal('2026-06-01 09:00')

    const next = InvoiceCadence.nextCutoffAfter(
      InvoiceCadenceTest.NY_MONDAY,
      cutoff,
    )

    expect(next.toISOString()).to.equal('2026-06-08T13:00:00.000Z')
    expect(
      InvoiceCadence.cutoffAtOrBefore(
        InvoiceCadenceTest.NY_MONDAY,
        cutoff,
      ).toISOString(),
    ).to.equal(cutoff.toISOString())
  }

  /**
   * The hour a spring forward skips has no 02:30 in it. The cutoff still has
   * to happen, so it lands on the first instant that exists after it.
   */
  @test()
  nextCutoff_onALocalTimeThatDoesNotExist_movesToTheNextInstantThatDoes() {
    const version: IInvoiceCadenceVersion = {
      ...InvoiceCadenceTest.NY_MONDAY,
      weekday: 0,
      cutoffLocal: '02:30',
    }

    const cutoff = InvoiceCadence.nextCutoffAfter(
      version,
      new Date('2026-03-07T00:00:00.000Z'),
    )

    expect(
      InvoiceCadenceTest.localReading(cutoff, 'America/New_York'),
    ).to.equal('2026-03-08 03:30')
    expect(cutoff.toISOString()).to.equal('2026-03-08T07:30:00.000Z')
  }

  /** A UTC cadence has no transitions at all, and is the simple case. */
  @test()
  nextCutoff_inUtc_isThePlainWeekday() {
    const version: IInvoiceCadenceVersion = {
      weekday: 5,
      timezone: 'UTC',
      cutoffLocal: '17:30',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      finalizationDelayHours: 24,
    }

    expect(
      InvoiceCadence.nextCutoffAfter(
        version,
        new Date('2026-06-01T00:00:00.000Z'),
      ).toISOString(),
    ).to.equal('2026-06-05T17:30:00.000Z')
  }

  @test()
  versionAt_isTheLatestOneAlreadyInForce() {
    const first = InvoiceCadenceTest.NY_MONDAY
    const second: IInvoiceCadenceVersion = {
      ...first,
      weekday: 5,
      effectiveFrom: '2026-06-01T00:00:00.000Z',
    }
    const versions = [second, first]

    expect(
      InvoiceCadence.versionAt(versions, new Date('2026-03-01T00:00:00.000Z'))
        ?.weekday,
    ).to.equal(1)
    expect(
      InvoiceCadence.versionAt(versions, new Date('2026-07-01T00:00:00.000Z'))
        ?.weekday,
    ).to.equal(5)
    expect(
      InvoiceCadence.versionAt(versions, new Date('2025-01-01T00:00:00.000Z')),
    ).to.equal(null)
  }

  /** Editing a rule that has not started yet replaces it rather than stacking. */
  @test()
  append_replacesAVersionWithTheSameEffectiveInstant() {
    const first = InvoiceCadenceTest.NY_MONDAY
    const corrected: IInvoiceCadenceVersion = { ...first, cutoffLocal: '18:00' }

    const versions = InvoiceCadence.append(
      InvoiceCadence.append([], first),
      corrected,
    )

    expect(versions).to.have.length(1)
    expect(versions[0].cutoffLocal).to.equal('18:00')
  }

  @test()
  append_keepsTheHistoryOrderedAndBounded() {
    let versions: IInvoiceCadenceVersion[] = []

    for (let week = 0; week < InvoiceCadence.MAX_VERSIONS + 5; week += 1) {
      versions = InvoiceCadence.append(versions, {
        ...InvoiceCadenceTest.NY_MONDAY,
        effectiveFrom: moment
          .utc('2026-01-01T00:00:00.000Z')
          .add(week, 'weeks')
          .toISOString(),
      })
    }

    expect(versions).to.have.length(InvoiceCadence.MAX_VERSIONS)
    expect(versions[0].effectiveFrom).to.equal('2026-02-05T00:00:00.000Z')

    const starts = versions.map((version) => Date.parse(version.effectiveFrom))

    expect(starts).to.deep.equal([...starts].sort((a, b) => a - b))
  }

  /**
   * A run on time has exactly the one period behind it to bill. The walk back
   * stops at the cadence's own start, which here is the Tuesday before.
   */
  @test()
  duePeriods_onTime_isOnePeriod() {
    // The Monday cutoff, plus the full finalization day, plus a minute.
    const now = new Date('2026-06-02T13:01:00.000Z')
    const due = InvoiceCadence.duePeriods([InvoiceCadenceTest.FROM_MAY_26], now)

    expect(due).to.have.length(1)
    expect(due[0].start).to.equal('2026-05-25T13:00:00.000Z')
    expect(due[0].end).to.equal('2026-06-01T13:00:00.000Z')
    expect(due[0].issueAt).to.equal('2026-06-02T13:00:00.000Z')
  }

  /** Inside the finalization window the period is not due yet. */
  @test()
  duePeriods_insideTheFinalizationWindow_isNothing() {
    const now = new Date('2026-06-01T23:00:00.000Z')

    expect(
      InvoiceCadence.duePeriods([InvoiceCadenceTest.FROM_MAY_26], now),
    ).to.have.length(0)
  }

  /** Three weeks missed is three periods, oldest first - never one big one. */
  @test()
  duePeriods_afterAMissedRun_isOnePeriodPerWeek() {
    const now = new Date('2026-06-16T13:01:00.000Z')
    const due = InvoiceCadence.duePeriods([InvoiceCadenceTest.FROM_MAY_26], now)

    expect(due.map((period) => period.end)).to.deep.equal([
      '2026-06-01T13:00:00.000Z',
      '2026-06-08T13:00:00.000Z',
      '2026-06-15T13:00:00.000Z',
    ])
  }

  /** A cadence set today does not reach back over hours nobody agreed to. */
  @test()
  duePeriods_stopAtTheEarliestEffectiveInstant() {
    const version: IInvoiceCadenceVersion = {
      ...InvoiceCadenceTest.NY_MONDAY,
      effectiveFrom: '2026-06-03T00:00:00.000Z',
    }
    const now = new Date('2026-06-30T13:01:00.000Z')
    const due = InvoiceCadence.duePeriods([version], now)

    expect(due.map((period) => period.end)).to.deep.equal([
      '2026-06-08T13:00:00.000Z',
      '2026-06-15T13:00:00.000Z',
      '2026-06-22T13:00:00.000Z',
      '2026-06-29T13:00:00.000Z',
    ])
  }

  /** And never more than the cap, however long the run has been missed. */
  @test()
  duePeriods_areCappedAtTheCatchupLimit() {
    const now = new Date('2027-06-01T13:01:00.000Z')

    expect(
      InvoiceCadence.duePeriods([InvoiceCadenceTest.NY_MONDAY], now),
    ).to.have.length(InvoiceCadence.MAX_CATCHUP_PERIODS)
  }

  /** Each period is measured by the rule that closed it, not by today's. */
  @test()
  duePeriods_acrossAVersionChange_useTheRuleThatClosedEachPeriod() {
    const monday = InvoiceCadenceTest.FROM_MAY_26
    const friday: IInvoiceCadenceVersion = {
      ...monday,
      weekday: 5,
      effectiveFrom: '2026-06-03T00:00:00.000Z',
    }
    const now = new Date('2026-06-20T13:01:00.000Z')
    const due = InvoiceCadence.duePeriods([monday, friday], now)

    // Fridays once the new rule is in force; the Monday before it closed the
    // period the old rule was still governing.
    expect(due.map((period) => period.end)).to.deep.equal([
      '2026-06-01T13:00:00.000Z',
      '2026-06-05T13:00:00.000Z',
      '2026-06-12T13:00:00.000Z',
      '2026-06-19T13:00:00.000Z',
    ])
    // The transitional period runs from the last Monday cutoff that actually
    // happened to the first Friday one, and is not split in two.
    expect(due[1].start).to.equal('2026-06-01T13:00:00.000Z')
  }

  @test()
  duePeriods_withoutACadence_isNothing() {
    expect(
      InvoiceCadence.duePeriods(null, new Date('2026-06-02T13:01:00.000Z')),
    ).to.have.length(0)
    expect(
      InvoiceCadence.duePeriods(
        [
          {
            ...InvoiceCadenceTest.NY_MONDAY,
            effectiveFrom: '2027-01-01T00:00:00.000Z',
          },
        ],
        new Date('2026-06-02T13:01:00.000Z'),
      ),
    ).to.have.length(0)
  }

  @test()
  problems_rejectEveryMalformedField() {
    expect(InvoiceCadence.problems(InvoiceCadenceTest.NY_MONDAY)).to.deep.equal(
      [],
    )

    const broken = InvoiceCadence.problems({
      weekday: 7,
      timezone: 'Mars/Olympus',
      cutoffLocal: '25:00',
      effectiveFrom: 'whenever',
      finalizationDelayHours: 1000,
    })

    expect(broken).to.have.length(5)
  }

  @test()
  problems_rejectAFractionalOrNegativeDelay() {
    expect(
      InvoiceCadence.problems({
        ...InvoiceCadenceTest.NY_MONDAY,
        finalizationDelayHours: -1,
      }),
    ).to.have.length(1)
    expect(
      InvoiceCadence.problems({
        ...InvoiceCadenceTest.NY_MONDAY,
        finalizationDelayHours: 1.5,
      }),
    ).to.have.length(1)
  }
}
