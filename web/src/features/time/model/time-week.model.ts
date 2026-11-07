import { createEvent, createStore, sample } from 'effector'

import {
  getTimeWeekDays,
  summarizeTimeWeek,
  toTimeDayFilter,
  toTimeWeekFilter,
  type TimeWeek,
} from './time-week'

import {
  statisticsWeekDailyQuery,
  statisticsWeekOverviewQuery,
  type StatisticsQuery,
} from '@/entities/statistics'
import { applyTimeFilters, changeTimeFilters } from '@/entities/time'
import { $breakpoints, toApiDateRange } from '@/shared'

type TimeWeekRequest = {
  week: TimeWeek
  /** The project filter, when one is set: the week follows it. */
  projectId: string | null
}

/** The page asks for its week's figures: on arrival and when the week moves. */
export const timeWeekRequested = createEvent<TimeWeekRequest>()
export const timeWeekDaySelected = createEvent<string>()
export const timeWeekWholeSelected = createEvent()

export const $timeWeek = createStore<TimeWeek | null>(null).on(
  timeWeekRequested,
  (_, { week }) => week,
)

const toStatisticsQuery = ({
  week,
  projectId,
}: TimeWeekRequest): StatisticsQuery => ({
  ...toApiDateRange(week),
  // Days are the reader's days, wherever the server is.
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  ...(projectId ? { projectIds: [projectId] } : {}),
})

sample({
  clock: timeWeekRequested,
  fn: toStatisticsQuery,
  target: [statisticsWeekOverviewQuery.start, statisticsWeekDailyQuery.start],
})

/** Server totals for the week, never sums of the entries loaded so far. */
export const $timeWeekSummary = statisticsWeekOverviewQuery.$data.map((rows) =>
  rows ? summarizeTimeWeek(rows) : null,
)

export const $timeWeekDays = sample({
  source: { week: $timeWeek, rows: statisticsWeekDailyQuery.$data },
  fn: ({ week, rows }) => (week && rows ? getTimeWeekDays(week, rows) : null),
})

export const $timeWeekPending = sample({
  source: {
    overview: statisticsWeekOverviewQuery.$pending,
    daily: statisticsWeekDailyQuery.$pending,
  },
  fn: ({ overview, daily }) => overview || daily,
})

export const $timeWeekFailed = sample({
  source: {
    overview: statisticsWeekOverviewQuery.$failed,
    daily: statisticsWeekDailyQuery.$failed,
  },
  fn: ({ overview, daily }) => overview || daily,
})

const timeWeekFilterChosen = createEvent<{ fromAt: number; toAt: number }>()

sample({
  clock: timeWeekDaySelected,
  fn: toTimeDayFilter,
  target: timeWeekFilterChosen,
})

sample({
  clock: timeWeekWholeSelected,
  source: $timeWeek,
  filter: (week): week is TimeWeek => week != null,
  fn: toTimeWeekFilter,
  target: timeWeekFilterChosen,
})

sample({ clock: timeWeekFilterChosen, target: changeTimeFilters })

/* The week sits outside the phone's filter drawer, whose fields are drafts
   until Apply: a day picked here takes effect at once. A desktop applies
   every filter change by itself. */
sample({
  clock: timeWeekFilterChosen,
  source: $breakpoints,
  filter: (breakpoints) => !breakpoints.isDesktop,
  target: applyTimeFilters,
})
