import { describe, expect, it } from 'vitest'

import {
  getTimeSelectedDay,
  getTimeWeek,
  getTimeWeekAnchor,
  getTimeWeekDays,
  summarizeTimeWeek,
  toTimeDayFilter,
  toTimeWeekFilter,
} from './time-week'

/** Local midnight, so a case reads the same wherever the suite runs. */
const day = (date: number) => new Date(2026, 10, date)

describe('getTimeWeek', () => {
  it('starts on the reader’s first weekday and holds seven days', () => {
    // Saturday 7 November 2026.
    expect(getTimeWeek(day(7), 0)).toEqual({
      from: '2026-11-01',
      to: '2026-11-07',
      days: [
        '2026-11-01',
        '2026-11-02',
        '2026-11-03',
        '2026-11-04',
        '2026-11-05',
        '2026-11-06',
        '2026-11-07',
      ],
    })
    expect(getTimeWeek(day(7), 1).from).toBe('2026-11-02')
  })
})

describe('getTimeWeekAnchor', () => {
  it('follows the filter’s end, then its start, then today', () => {
    const now = day(20)

    expect(
      getTimeWeekAnchor(
        { fromAt: day(3).getTime(), toAt: day(9).getTime() },
        now,
      ),
    ).toEqual(day(9))
    expect(
      getTimeWeekAnchor({ fromAt: day(3).getTime(), toAt: null }, now),
    ).toEqual(day(3))
    expect(getTimeWeekAnchor({ fromAt: null, toAt: null }, now)).toEqual(now)
  })
})

describe('getTimeWeekDays', () => {
  it('adds the projects of a day together and keeps empty days at zero', () => {
    const week = getTimeWeek(day(7), 0)
    const days = getTimeWeekDays(week, [
      { day: '2026-11-02', projectId: 'a', trackedSeconds: 600 },
      { day: '2026-11-02', projectId: 'b', trackedSeconds: 300 },
      { day: '2026-11-07', projectId: 'a', trackedSeconds: 60 },
      // A day outside the week is not this week's.
      { day: '2026-11-09', projectId: 'a', trackedSeconds: 999 },
    ])

    expect(days.map((entry) => entry.trackedSeconds)).toEqual([
      0, 900, 0, 0, 0, 0, 60,
    ])
  })
})

describe('summarizeTimeWeek', () => {
  it('sums every project and counts those with time', () => {
    expect(
      summarizeTimeWeek([
        {
          projectId: 'a',
          trackedSeconds: 600,
          activeSeconds: 300,
          earnedCents: 1000,
        },
        { projectId: 'b', trackedSeconds: 0, activeSeconds: 0, earnedCents: 0 },
        {
          projectId: 'c',
          trackedSeconds: 60,
          activeSeconds: 30,
          earnedCents: 100,
        },
      ]),
    ).toEqual({
      trackedSeconds: 660,
      activeSeconds: 330,
      earnedCents: 1100,
      projectCount: 2,
    })
  })

  it('leaves out what the reader may not see instead of reporting zero', () => {
    const summary = summarizeTimeWeek([{ projectId: 'a', trackedSeconds: 600 }])

    expect(summary.activeSeconds).toBeUndefined()
    expect(summary.earnedCents).toBeUndefined()
  })
})

describe('day and week filters', () => {
  it('names a day only when the filter covers exactly that day', () => {
    const filter = toTimeDayFilter('2026-11-05')

    expect(getTimeSelectedDay(filter)).toBe('2026-11-05')
    expect(
      getTimeSelectedDay(toTimeWeekFilter(getTimeWeek(day(7), 0))),
    ).toBeNull()
    expect(getTimeSelectedDay({ fromAt: null, toAt: null })).toBeNull()
  })
})
