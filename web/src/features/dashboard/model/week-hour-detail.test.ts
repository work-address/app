import { describe, expect, it } from 'vitest'

import { weekHourDetail } from './week-hour-detail'

import type { StatisticsHourlyRow } from '@/entities/statistics'

const row = (
  hour: number,
  activeSeconds: number,
  patch: Partial<StatisticsHourlyRow> = {},
): StatisticsHourlyRow => ({
  weekday: 1,
  hour,
  activeSeconds,
  trackedSeconds: activeSeconds * 2,
  keyboardKeys: 0,
  mouseKeys: 0,
  days: 1,
  projects: [],
  apps: [],
  ...patch,
})

const rows = [
  row(9, 7200, { keyboardKeys: 4000, mouseKeys: 600, days: 3 }),
  row(10, 3600),
  row(14, 1200),
]

describe('week-hour detail', () => {
  it('puts an hour in the context of its weeks, the other hours and its input', () => {
    expect(weekHourDetail(rows[0], rows, 28)).toEqual({
      activeMinutes: 120,
      trackedMinutes: 240,
      activeShare: 0.5,
      days: 3,
      weeks: 4,
      weeklyMinutes: 30,
      share: 0.6,
      rank: 1,
      rankedHours: 3,
      keysPerActiveHour: 2000,
      clicksPerActiveHour: 300,
      busiest: true,
    })
    expect(weekHourDetail(rows[2], rows, 28)).toMatchObject({
      rank: 3,
      busiest: false,
    })
  })

  it('reads an hour with no time as idle, unranked and unmeasured', () => {
    expect(weekHourDetail(undefined, rows, 28)).toMatchObject({
      activeMinutes: 0,
      activeShare: null,
      rank: null,
      keysPerActiveHour: null,
      busiest: false,
    })
  })
})
