import { combine, createEvent, createStore, sample } from 'effector'

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
  timeEntriesInvoiced,
} from './time.events'
import {
  deleteTimeMutation,
  editTimeMutation,
  removeTimeLocationsMutation,
  removeTimeProcessesMutation,
  removeTimeScreenshotMutation,
  setTimePaidStatusMutation,
} from './time.mutations'
import {
  recentScreenshotsQuery,
  timeQuery,
  type RecentEntriesParams,
  type TimeQueryParams,
} from './time.queries'
import {
  $hasMoreTime,
  $timeFilters,
  $timeOutOfStep,
  $timePage,
  $timeSort,
} from './time.stores'

import type { TimeFilters, TimeSort } from './types'

import { $breakpoints } from '@/shared'

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
    outOfStep: $timeOutOfStep,
  },
  filter: ({ hasMore, pending }) => hasMore && !pending,
  fn: ({ filters, sort, page, outOfStep }): TimeQueryParams => ({
    ...toTimeQueryParams(filters, sort, page + 1),
    // The reload after a delete failed, so the next page cannot be trusted
    // to follow on: read up to it afresh instead.
    ...(outOfStep ? { reloadThroughPage: page + 1 } : {}),
  }),
  target: timeQuery.start,
})

// Deleting takes rows out of the pages already loaded, and the server pages
// by offset: asking for the next page from here would skip as many rows as
// left. Reading the loaded pages again lines the list up first.
sample({
  clock: deleteTimeMutation.finished.success,
  source: {
    filters: $timeFilters,
    sort: $timeSort,
    page: $timePage,
    status: timeQuery.$status,
  },
  // Entries are deleted from the dashboard too, where no list is loaded.
  filter: ({ status }) => status !== 'initial',
  fn: ({ filters, sort, page }): TimeQueryParams => ({
    ...toTimeQueryParams(filters, sort, page),
    reloadThroughPage: page,
    quiet: true,
  }),
  target: timeQuery.start,
})

/**
 * The dashboard's screenshot strip is a query result, kept as it arrived, so
 * a change to an entry does not reach it by itself. After any such change it
 * is read again with what it was last asked.
 */
const $recentScreenshotsParams = createStore<RecentEntriesParams | null>(
  null,
).on(recentScreenshotsQuery.start, (_, params) => params)
const recentScreenshotsRefreshed = createEvent()
const $recentScreenshotsRefreshing = createStore(false)
  .on(recentScreenshotsRefreshed, () => true)
  .on(recentScreenshotsQuery.finished.finally, () => false)

sample({
  clock: [
    deleteTimeMutation.finished.success,
    editTimeMutation.finished.success,
    setTimePaidStatusMutation.finished.success,
    removeTimeScreenshotMutation.finished.success,
    removeTimeProcessesMutation.finished.success,
    removeTimeLocationsMutation.finished.success,
    timeEntriesInvoiced,
  ],
  source: $recentScreenshotsParams,
  filter: (params): params is RecentEntriesParams => params !== null,
  target: [recentScreenshotsRefreshed, recentScreenshotsQuery.start],
})

/**
 * Whether the strip has screenshots to show: loaded, or loaded before and
 * being read again. A strip that vanished during its own refresh would take
 * the open entry with it.
 */
export const $recentScreenshotsShown = combine(
  recentScreenshotsQuery.$succeeded,
  $recentScreenshotsRefreshing,
  (succeeded, refreshing) => succeeded || refreshing,
)

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
  timeEntriesInvoiced,
  resetTimeSort,
  restoreTimeQuery,
  loadMoreTime,
} from './time.events'

export {
  recentAgentRunsQuery,
  recentScreenshotsQuery,
  recentTimeQuery,
  timeAgentRunsQuery,
  timeQuery,
  type TimeAgentRun,
  type TimeAgentSegment,
  type TimeQueryParams,
  type RecentTimeParams,
  type RecentDesktopTimeParams,
  type RecentEntriesParams,
} from './time.queries'

export {
  deleteTimeMutation,
  editTimeMutation,
  removeAgentPromptMutation,
  removeTimeLocationsMutation,
  removeTimeProcessesMutation,
  removeTimeScreenshotMutation,
  setTimePaidStatusMutation,
} from './time.mutations'

export {
  $allTime,
  $removedPromptRunKeys,
  $timeFilters,
  $hasActiveTimeFilters,
  $timeSort,
  $timeLoading,
  $timeFailed,
  $isTimeFiltering,
  $hasMoreTime,
  $isLoadingMoreTime,
  $timeEntriesTotal,
} from './time.stores'

export { TimeEmptyState } from './ui'
