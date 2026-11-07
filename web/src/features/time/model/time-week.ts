import { addDays, startOfWeek } from 'date-fns'

import type {
  StatisticsDailyRow,
  StatisticsTotalsRow,
} from '@/entities/statistics'
import type { TimeFilters } from '@/entities/time'

import { fromDay, toDay } from '@/shared'

/** 0 is Sunday, as date-fns counts. */
type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** Seven reader's days, first to last; `to` is the last day, inclusive. */
export type TimeWeek = {
  from: string
  to: string
  days: string[]
}

export type TimeWeekDay = {
  day: string
  trackedSeconds: number
}

export type TimeWeekSummary = {
  trackedSeconds: number
  /** Missing when the reader may not see activity, e.g. a viewer. */
  activeSeconds?: number
  /** Missing when the reader may not see money. */
  earnedCents?: number
  projectCount: number
}

/** The week the page shows: the one holding the filter's end, else its start, else today. */
export const getTimeWeekAnchor = (
  filters: Pick<TimeFilters, 'fromAt' | 'toAt'>,
  now: Date,
): Date => new Date(filters.toAt ?? filters.fromAt ?? now.getTime())

export const getTimeWeek = (
  anchor: Date,
  weekStartsOn: WeekStart,
): TimeWeek => {
  const first = startOfWeek(anchor, { weekStartsOn })
  const days = Array.from({ length: 7 }, (_, index) =>
    toDay(addDays(first, index)),
  )

  return { from: days[0], to: days[6], days }
}

/** Each day of the week with its tracked time, every project together. */
export const getTimeWeekDays = (
  week: TimeWeek,
  rows: StatisticsDailyRow[],
): TimeWeekDay[] => {
  const totals = new Map<string, number>()

  for (const row of rows) {
    totals.set(row.day, (totals.get(row.day) ?? 0) + row.trackedSeconds)
  }

  return week.days.map((day) => ({
    day,
    trackedSeconds: totals.get(day) ?? 0,
  }))
}

/**
 * The week's totals across projects. A figure the reader may not see for any
 * project stays missing rather than reading as zero.
 */
export const summarizeTimeWeek = (
  rows: StatisticsTotalsRow[],
): TimeWeekSummary => {
  const sum = (key: 'activeSeconds' | 'earnedCents') =>
    rows.some((row) => row[key] != null)
      ? rows.reduce((total, row) => total + (row[key] ?? 0), 0)
      : undefined

  return {
    trackedSeconds: rows.reduce((total, row) => total + row.trackedSeconds, 0),
    activeSeconds: sum('activeSeconds'),
    earnedCents: sum('earnedCents'),
    projectCount: rows.filter((row) => row.trackedSeconds > 0).length,
  }
}

/** Which day the date filter names alone, if it names exactly one. */
export const getTimeSelectedDay = (
  filters: Pick<TimeFilters, 'fromAt' | 'toAt'>,
): string | null => {
  if (filters.fromAt == null || filters.toAt == null) {
    return null
  }

  const from = toDay(new Date(filters.fromAt))

  return from === toDay(new Date(filters.toAt)) ? from : null
}

/** The date filter for one day, or for the whole week. */
export const toTimeDayFilter = (day: string) => {
  const start = fromDay(day).getTime()

  return { fromAt: start, toAt: start }
}

export const toTimeWeekFilter = (week: TimeWeek) => ({
  fromAt: fromDay(week.from).getTime(),
  toAt: fromDay(week.to).getTime(),
})
