import { combine, createStore, restore } from 'effector'

import {
  changeWorklogFilters,
  appendWorklogSort,
  resetWorklogSort,
  changeActivityStateFilter,
  setWorklogsLoading,
} from './activities.events'
import {
  activitiesQuery,
  activitiesStatsQuery,
  worklogsQuery,
  activityDetailQuery,
  activityReportQuery,
} from './activities.queries'
import { mapProjectsAndStats } from './utils'

import type {
  ProjectWithStats,
  ProjectInvoice,
  ITimeTotalDetail,
  WorklogsFilters,
  WorklogSort,
  ActivityStateFilter,
} from './types'
import type { baseApi } from '@/shared'

export const $activityStateFilter = createStore<ActivityStateFilter>('all').on(
  changeActivityStateFilter,
  (_, filter) => filter,
)

export const $worklogsFilters = createStore<WorklogsFilters>({
  page: 0,
  fromAt: null,
  toAt: null,
  activityId: null,
  note: null,
  timeActiveMin: null,
  timeActiveMax: null,
  keyboardKeysMin: null,
  keyboardKeysMax: null,
  mouseKeysMin: null,
  mouseKeysMax: null,
  mouseDistanceMin: null,
  mouseDistanceMax: null,
}).on(changeWorklogFilters, (state, filters) => ({ ...state, ...filters }))

export const $worklogSort = createStore<WorklogSort>({ fromAt: 'DESC' })
  .on(appendWorklogSort, (state, sort) => ({ ...state, ...sort }))
  .on(resetWorklogSort, (_, payload) => payload ?? { fromAt: 'DESC' })

export const $allWorklogs = combine(
  worklogsQuery.$data,
  (time) => time?.items ?? [],
)

export const $isWorklogsFiltering = createStore(false)
  .on([$worklogsFilters, $worklogSort], () => true)
  .on(worklogsQuery.finished.finally, () => false)

export const $activitiesLoading = combine(
  activitiesQuery.$pending,
  activitiesStatsQuery.$pending,
  worklogsQuery.$pending,
  (...flags) => flags.some((flag) => flag),
)

export const $worklogsLoading = restore(setWorklogsLoading, false).on(
  worklogsQuery.$pending,
  (_, payload) => payload,
)

export const $rawActivities = activitiesQuery.$data.map(
  (activities) =>
    activities?.items.reduce(
      (acc, activity) => {
        if (activity.id) {
          acc[activity.id] = activity
        }

        return acc
      },
      {} as Record<string, baseApi.Activity>,
    ) ?? {},
)

export const $activities = combine(
  activitiesQuery.$data,
  activitiesStatsQuery.$data,
  $activityStateFilter,
  (projects, stats): ProjectWithStats[] =>
    mapProjectsAndStats(projects?.items, stats ?? undefined),
)

export const $filteredActivities = combine(
  $activities,
  $activityStateFilter,
  (activities, filter): ProjectWithStats[] => {
    if (filter === 'all') {
      return activities
    }

    return activities.filter((project) => project.state === filter)
  },
)

export const $invoice = combine(
  activityDetailQuery.$data,
  activityReportQuery.$data,
  (detail, report): ProjectInvoice | null => {
    if (!detail) {
      return null
    }

    const totalAmount =
      ((report?.totals[0]?.rateHour ?? 0) / 60) *
      (report?.totals[0]?.minutesActive ?? 0)

    return {
      ...detail,
      report: report?.totals[0] ?? undefined,
      totalAmount,
    }
  },
)

export const $invoiceWorklogs = combine(
  activityReportQuery.$data,
  (report): ITimeTotalDetail[] => report?.time ?? [],
)

export const $invoiceLoading = combine(
  activityDetailQuery.$pending,
  activityReportQuery.$pending,
  (...flags) => flags.some((flag) => flag),
)

export const $hasProjects = $activities.map(
  (activities) => activities.length > 0,
)
