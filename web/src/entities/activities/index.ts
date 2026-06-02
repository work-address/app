import { combine, sample } from 'effector'

import {
  fetchActivities,
  fetchWorklogs,
  applyWorklogFilters,
  changeWorklogFilters,
  appendWorklogSort,
  resetWorklogSort,
  setWorklogsLoading,
  debouncedChangeWorklogFilters,
} from './activities.events'
import {
  createActivityMutation,
  deleteActivityMutation,
  editActivityMutation,
} from './activities.mutations'
import {
  activitiesQuery,
  activitiesStatsQuery,
  worklogsQuery,
  type WorklogsQueryParams,
} from './activities.queries'
import { $worklogSort, $worklogsFilters } from './activities.stores'

import { $breakpoints } from '@/shared'

sample({
  clock: fetchActivities,
  target: [activitiesQuery.start, fetchWorklogs],
})

sample({
  clock: activitiesQuery.finished.success,
  fn: ({ result }) =>
    result.items
      .map((project) => project.id)
      .filter((id): id is string => Boolean(id)),
  target: activitiesStatsQuery.start,
})

sample({
  clock: [fetchWorklogs, applyWorklogFilters],
  source: combine($worklogsFilters, $worklogSort),
  fn: ([filters, sort]): WorklogsQueryParams => {
    return {
      ...Object.fromEntries(
        Object.entries(filters).map(([key, value]) => [
          key,
          value ?? undefined,
        ]),
      ),
      sort,
    }
  },
  target: worklogsQuery.start,
})

sample({
  clock: [resetWorklogSort, appendWorklogSort],
  target: applyWorklogFilters,
})

sample({
  clock: debouncedChangeWorklogFilters,
  source: $breakpoints,
  filter: (breakpoints) => breakpoints.isDesktop,
  target: applyWorklogFilters,
})

sample({
  clock: changeWorklogFilters,
  source: $breakpoints,
  filter: (breakpoints) => breakpoints.isDesktop,
  target: setWorklogsLoading.prepend(() => true),
})

sample({
  clock: [
    createActivityMutation.finished.success.map(() => void 0),
    deleteActivityMutation.finished.success.map(() => void 0),
    editActivityMutation.finished.success.map(() => void 0),
  ],
  target: activitiesQuery.start,
})

export {
  type ProjectWithStats,
  type ITimeTotal,
  type ITimeTotalDetail,
  type Time,
  type WorklogsFilters,
  type WorklogSort,
  type ProjectsFilter,
} from './types'

export {
  fetchActivities,
  changeWorklogFilters,
  appendWorklogSort as changeWorklogSort,
  applyWorklogFilters,
  resetWorklogSort,
  changeActivityStateFilter,
  setActivitiesStateFiltering,
} from './activities.events'

export {
  createActivityMutation,
  deleteActivityMutation,
  editActivityMutation,
} from './activities.mutations'

export {
  $activities,
  $activitiesLoading,
  $allWorklogs,
  $hasProjects,
  $worklogsFilters,
  $worklogSort,
  $worklogsLoading,
  $filteredActivities,
  $activityStateFilter,
  $isWorklogsFiltering,
  $isActivitiesFiltering,
  $rawActivities,
} from './activities.stores'
