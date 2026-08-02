import { combine, sample } from 'effector'

import {
  fetchWorklogs,
  applyWorklogFilters,
  changeWorklogFilters,
  appendWorklogSort,
  resetWorklogFilters,
  resetWorklogSort,
  setWorklogsLoading,
  debouncedChangeWorklogFilters,
} from './time.events'
import {
  deleteWorklogMutation,
  editWorklogMutation,
  removeWorklogProcessesMutation,
  removeWorklogScreenshotMutation,
  setWorklogPaidStatusMutation,
} from './time.mutations'
import { worklogsQuery, type WorklogsQueryParams } from './time.queries'
import { $worklogSort, $worklogsFilters } from './time.stores'

import { $breakpoints } from '@/shared'

sample({
  clock: [fetchWorklogs, applyWorklogFilters],
  source: combine($worklogsFilters, $worklogSort),
  fn: ([filters, sort]): WorklogsQueryParams => ({
    ...Object.fromEntries(
      Object.entries(filters).map(([key, value]) => [key, value ?? undefined]),
    ),
    sort,
  }),
  target: worklogsQuery.start,
})

sample({
  clock: [resetWorklogSort, appendWorklogSort, resetWorklogFilters],
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
    deleteWorklogMutation.finished.success.map(() => void 0),
    editWorklogMutation.finished.success.map(() => void 0),
    removeWorklogScreenshotMutation.finished.success.map(() => void 0),
    removeWorklogProcessesMutation.finished.success.map(() => void 0),
    setWorklogPaidStatusMutation.finished.success.map(() => void 0),
  ],
  target: applyWorklogFilters,
})

export {
  type ITimeTotal,
  type TimeTotalDetail as ITimeTotalDetail,
  type Time,
  type WorklogsFilters,
  type WorklogSort,
} from './types'

export {
  fetchWorklogs,
  changeWorklogFilters,
  appendWorklogSort as changeWorklogSort,
  applyWorklogFilters,
  resetWorklogFilters,
  resetWorklogSort,
} from './time.events'

export {
  deleteWorklogMutation,
  editWorklogMutation,
  removeWorklogProcessesMutation,
  removeWorklogScreenshotMutation,
  setWorklogPaidStatusMutation,
} from './time.mutations'

export {
  $allWorklogs,
  $worklogsFilters,
  $hasActiveWorklogFilters,
  $worklogSort,
  $worklogsLoading,
  $isWorklogsFiltering,
} from './time.stores'
