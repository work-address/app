import { combine, sample } from 'effector'
import i18n from 'i18next'

import {
  fetchWorklogs,
  applyWorklogFilters,
  changeWorklogFilters,
  appendWorklogSort,
  resetWorklogFilters,
  resetWorklogSort,
  setWorklogsLoading,
  debouncedChangeWorklogFilters,
  loadMoreWorklogs,
} from './time.events'
import { worklogsQuery, type WorklogsQueryParams } from './time.queries'
import {
  $hasMoreWorklogs,
  $worklogSort,
  $worklogsFilters,
  $worklogsPage,
} from './time.stores'

import type { WorklogsFilters, WorklogSort } from './types'

import { $breakpoints, showToast } from '@/shared'

const toWorklogsQueryParams = (
  filters: WorklogsFilters,
  sort: WorklogSort,
  page: number,
): WorklogsQueryParams => ({
  ...Object.fromEntries(
    Object.entries(filters).map(([key, value]) => [key, value ?? undefined]),
  ),
  page,
  sort,
})

sample({
  clock: [fetchWorklogs, applyWorklogFilters],
  source: combine($worklogsFilters, $worklogSort),
  fn: ([filters, sort]): WorklogsQueryParams =>
    toWorklogsQueryParams(filters, sort, 0),
  target: worklogsQuery.start,
})

sample({
  clock: loadMoreWorklogs,
  source: {
    filters: $worklogsFilters,
    sort: $worklogSort,
    page: $worklogsPage,
    hasMore: $hasMoreWorklogs,
    pending: worklogsQuery.$pending,
  },
  filter: ({ hasMore, pending }) => hasMore && !pending,
  fn: ({ filters, sort, page }): WorklogsQueryParams =>
    toWorklogsQueryParams(filters, sort, page + 1),
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

worklogsQuery.finished.failure.watch(({ params }) => {
  if ((params.page ?? 0) === 0) {
    return
  }

  showToast('error', {
    message: i18n.t('dashboard.worklogsTable.loadMoreError'),
    position: 'top-center',
  })
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
  loadMoreWorklogs,
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
  $hasMoreWorklogs,
  $isLoadingMoreWorklogs,
} from './time.stores'
