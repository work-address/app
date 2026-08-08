import { combine, sample } from 'effector'
import i18n from 'i18next'

import {
  applyTimeFilters,
  appendTimeSort,
  changeTimeFilters,
  debouncedChangeTimeFilters,
  fetchTime,
  loadMoreTime,
  resetTimeFilters,
  resetTimeSort,
  setTimeLoading,
} from './time.events'
import { timeQuery, type TimeQueryParams } from './time.queries'
import { $hasMoreTime, $timeFilters, $timePage, $timeSort } from './time.stores'

import type { TimeFilters, TimeSort } from './types'

import { $breakpoints, showToast } from '@/shared'

const toTimeQueryParams = (
  filters: TimeFilters,
  sort: TimeSort,
  page: number,
): TimeQueryParams => ({
  ...Object.fromEntries(
    Object.entries(filters).map(([key, value]) => [key, value ?? undefined]),
  ),
  page,
  sort,
})

sample({
  clock: [fetchTime, applyTimeFilters],
  source: combine($timeFilters, $timeSort),
  fn: ([filters, sort]): TimeQueryParams => toTimeQueryParams(filters, sort, 0),
  target: timeQuery.start,
})

sample({
  clock: loadMoreTime,
  source: {
    filters: $timeFilters,
    sort: $timeSort,
    page: $timePage,
    hasMore: $hasMoreTime,
    pending: timeQuery.$pending,
  },
  filter: ({ hasMore, pending }) => hasMore && !pending,
  fn: ({ filters, sort, page }): TimeQueryParams =>
    toTimeQueryParams(filters, sort, page + 1),
  target: timeQuery.start,
})

sample({
  clock: [resetTimeSort, appendTimeSort, resetTimeFilters],
  target: applyTimeFilters,
})

sample({
  clock: debouncedChangeTimeFilters,
  source: $breakpoints,
  filter: (breakpoints) => breakpoints.isDesktop,
  target: applyTimeFilters,
})

sample({
  clock: changeTimeFilters,
  source: $breakpoints,
  filter: (breakpoints) => breakpoints.isDesktop,
  target: setTimeLoading.prepend(() => true),
})

timeQuery.finished.failure.watch(({ params }) => {
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
  type TimeFilters,
  type TimeSort,
} from './types'

export {
  fetchTime,
  changeTimeFilters,
  appendTimeSort as changeTimeSort,
  applyTimeFilters,
  resetTimeFilters,
  resetTimeSort,
  loadMoreTime,
} from './time.events'

export {
  deleteTimeMutation,
  editTimeMutation,
  removeTimeProcessesMutation,
  removeTimeScreenshotMutation,
  setTimePaidStatusMutation,
} from './time.mutations'

export {
  $allTime,
  $timeFilters,
  $hasActiveTimeFilters,
  $timeSort,
  $timeLoading,
  $isTimeFiltering,
  $hasMoreTime,
  $isLoadingMoreTime,
} from './time.stores'
