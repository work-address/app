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
  recentLocationsQuery,
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
 * The dashboard's screenshot strip and map are query results, kept as they
 * arrived, so a change to an entry does not reach them by themselves. After
 * any such change each is read again with what it was last asked.
 *
 * Returns whether the widget has something to show: loaded, or loaded before
 * and being read again. A widget that vanished during its own refresh would
 * take the open entry with it.
 */
const keepFreshAfterEntryChanges = (
  query: typeof recentScreenshotsQuery | typeof recentLocationsQuery,
) => {
  const $params = createStore<RecentEntriesParams | null>(null).on(
    query.start,
    (_, params) => params,
  )
  const refreshed = createEvent()
  const $refreshing = createStore(false)
    .on(refreshed, () => true)
    .on(query.finished.finally, () => false)

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
    source: $params,
    filter: (params): params is RecentEntriesParams => params !== null,
    target: [refreshed, query.start],
  })

  return combine(
    query.$succeeded,
    $refreshing,
    (succeeded, refreshing) => succeeded || refreshing,
  )
}

/** Whether the dashboard's screenshot strip has screenshots to show. */
export const $recentScreenshotsShown = keepFreshAfterEntryChanges(
  recentScreenshotsQuery,
)

/** Whether the dashboard's map has phone entries to show. */
export const $recentLocationsShown =
  keepFreshAfterEntryChanges(recentLocationsQuery)

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
  recentLocationsQuery,
  recentScreenshotsQuery,
  recentTimeQuery,
  timeAgentRunsQuery,
  timeQuery,
  timeTrailQuery,
  type TimeTrailParams,
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
