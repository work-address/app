import { combine, createStore, restore } from 'effector'

import {
  changeWorklogFilters,
  appendWorklogSort,
  resetWorklogSort,
  changeActivityStateFilter,
  setWorklogsLoading,
  setActivitiesStateFiltering,
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
  ProjectsFilter,
} from './types'
import type { baseApi } from '@/shared'

export const $activityStateFilter = createStore<ProjectsFilter>({
  projectState: 'All',
  containsText: '',
}).on(changeActivityStateFilter, (state, filter) => ({
  ...state,
  ...filter,
}))

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
      (acc, project) => {
        if (project.id) {
          acc[project.id] = project
        }

        return acc
      },
      {} as Record<string, baseApi.Project>,
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
    let filteredActivities = [...activities]

    if (filter.projectState !== 'All') {
      filteredActivities = filteredActivities.filter(
        (project) => project.state === filter.projectState,
      )
    }

    if (filter.containsText) {
      filteredActivities = filteredActivities.filter(
        (project) =>
          project.title
            .toLowerCase()
            .includes(filter.containsText.trim().toLowerCase()) ||
          project.text
            ?.toLowerCase()
            .includes(filter.containsText.trim().toLowerCase()),
      )
    }

    return filteredActivities
  },
)

export const $isActivitiesFiltering = createStore(false)
  .on(setActivitiesStateFiltering, (_, payload) => payload)
  .on($filteredActivities, () => false)

export const $invoice = combine(
  activityDetailQuery.$data,
  activityReportQuery.$data,
  (detail, report): ProjectInvoice | null => {
    if (!detail) {
      return null
    }

    const rateHour = report?.totals[0]?.rateHour ?? 0
    const minutesActive = report?.totals[0]?.minutesActive ?? 0

    const totalAmount = (rateHour / 60) * minutesActive

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
