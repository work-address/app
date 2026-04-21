import { combine, sample } from 'effector'
import { debounce } from 'patronum/debounce'

import {
  fetchActivities,
  fetchInvoice,
  fetchWorklogs,
  applyWorklogFilters,
  changeWorklogFilters,
  appendWorklogSort,
  resetWorklogSort,
  setWorklogsLoading,
} from './activities.events'
import {
  createActivityMutation,
  deleteActivityMutation,
  editActivityMutation,
} from './activities.mutations'
import {
  activitiesQuery,
  activitiesStatsQuery,
  activityDetailQuery,
  activityReportQuery,
  worklogsQuery,
  type WorklogsQueryParams,
} from './activities.queries'
import { $worklogSort, $worklogsFilters } from './activities.stores'

import { $breakpoints } from '@/features/shared'

sample({
  clock: fetchActivities,
  target: [activitiesQuery.start, activitiesStatsQuery.start, fetchWorklogs],
})

sample({
  clock: fetchInvoice,
  fn: ({ id }) => id,
  target: [activityDetailQuery.start, activityReportQuery.start],
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

const DESKTOP_CHANGE_FILTERS_DEBOUNCE_TIME = 1500

const debouncedChangedWorklogFilters = debounce(
  changeWorklogFilters,
  DESKTOP_CHANGE_FILTERS_DEBOUNCE_TIME,
)

sample({
  clock: [resetWorklogSort, appendWorklogSort],
  target: applyWorklogFilters,
})

sample({
  clock: debouncedChangedWorklogFilters,
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
  target: [activitiesQuery.start, activitiesStatsQuery.start],
})

export {
  type ProjectWithStats,
  type ITimeTotal,
  type ITimeTotalDetail,
  type Time,
  type WorklogsFilters,
  type WorklogSort,
  type ActivityStateFilter,
} from './types'

export {
  fetchActivities,
  fetchInvoice,
  changeWorklogFilters,
  appendWorklogSort as changeWorklogSort,
  applyWorklogFilters,
  resetWorklogSort,
  changeActivityStateFilter,
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
  $invoiceWorklogs,
  $invoice,
  $invoiceLoading,
  $hasProjects,
  $worklogsFilters,
  $worklogSort,
  $worklogsLoading,
  $filteredActivities,
  $activityStateFilter,
  $isWorklogsFiltering,
  $rawActivities,
} from './activities.stores'
