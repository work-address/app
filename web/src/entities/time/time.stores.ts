import { combine, createStore, restore } from 'effector'

import {
  applyTimeFilters,
  appendTimeSort,
  changeTimeFilters,
  fetchTime,
  resetTimeFilters,
  timeEntriesInvoiced,
  resetTimeSort,
  restoreTimeQuery,
  setTimeLoading,
} from './time.events'
import {
  deleteTimeMutation,
  editTimeMutation,
  removeAgentPromptMutation,
  removeTimeLocationsMutation,
  removeTimeProcessesMutation,
  removeTimeScreenshotMutation,
  setTimePaidStatusMutation,
} from './time.mutations'
import { timeQuery, type TimeQueryParams } from './time.queries'

import type { Time, TimeFilters, TimeSort } from './types'

/**
 * Runs whose prompt was removed since their lists loaded. Those lists are
 * query results, kept as they arrived; the next load has the prompt gone.
 */
export const $removedPromptRunKeys = createStore<ReadonlySet<string>>(
  new Set(),
).on(removeAgentPromptMutation.finished.success, (runKeys, { params }) =>
  new Set(runKeys).add(params),
)

const DEFAULT_TIME_FILTERS: TimeFilters = {
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
}

const isReload = (params: TimeQueryParams) =>
  params.reloadThroughPage !== undefined

/** A reload happens behind the list, so it is never the list's first load. */
const isFirstPage = (params: TimeQueryParams) =>
  (params.page ?? 0) === 0 && !isReload(params)

type TimeFeed = {
  items: Time[]
  /** Set once a page comes back without adding anything new. */
  endReached: boolean
}

const EMPTY_FEED: TimeFeed = { items: [], endReached: false }

const patchTimeItems = (
  feed: TimeFeed,
  ids: string[],
  patch: (item: Time) => Time,
): TimeFeed => {
  const targetIds = new Set(ids)

  return {
    ...feed,
    items: feed.items.map((item) =>
      item.id && targetIds.has(item.id) ? patch(item) : item,
    ),
  }
}

export const $timeFilters = createStore<TimeFilters>(DEFAULT_TIME_FILTERS)
  .on(changeTimeFilters, (state, filters) => ({ ...state, ...filters }))
  .on(restoreTimeQuery, (_, { filters }) => ({
    ...DEFAULT_TIME_FILTERS,
    ...filters,
  }))
  .reset(resetTimeFilters)

export const $hasActiveTimeFilters = $timeFilters.map((filters) =>
  (Object.keys(DEFAULT_TIME_FILTERS) as (keyof TimeFilters)[]).some(
    (key) => filters[key] !== DEFAULT_TIME_FILTERS[key],
  ),
)

export const $timeSort = createStore<TimeSort>({ fromAt: 'DESC' })
  .on(appendTimeSort, (state, sort) => ({ ...state, ...sort }))
  .on(resetTimeSort, (_, payload) => payload ?? { fromAt: 'DESC' })
  .on(restoreTimeQuery, (_, { sort }) => sort)

export const $timePage = createStore(0)
  .on(timeQuery.finished.success, (_, { params }) => params.page ?? 0)
  .on([applyTimeFilters, fetchTime, resetTimeFilters], () => 0)

/**
 * Rows have left since the loaded pages were read, so the next page by offset
 * would skip some. True until the loaded pages are read again.
 */
export const $timeOutOfStep = createStore(false)
  .on(deleteTimeMutation.finished.success, () => true)
  .on(timeQuery.finished.success, (outOfStep, { params }) =>
    isFirstPage(params) || isReload(params) ? false : outOfStep,
  )
  .reset(resetTimeFilters)

export const $timeEntriesTotal = createStore(0)
  .on(timeQuery.finished.success, (_, { result }) => result.total)
  .on(deleteTimeMutation.finished.success, (total, { params }) =>
    Math.max(0, total - params.length),
  )
  .reset(resetTimeFilters)

/**
 * Accumulates the pages loaded so far. Mutations patch the loaded rows in
 * place instead of refetching, so an edit does not throw away the pages the
 * user has already scrolled through.
 */
const $timeFeed = createStore<TimeFeed>(EMPTY_FEED)
  .on(timeEntriesInvoiced, (feed, ids) =>
    patchTimeItems(feed, ids, (item) => ({ ...item, isInvoiced: true })),
  )
  .on(timeQuery.finished.success, (feed, { params, result }) => {
    const { items } = result

    if (isFirstPage(params) || isReload(params)) {
      return { items, endReached: items.length === 0 }
    }

    const existingIds = new Set(feed.items.map((item) => item.id))
    const nextItems = items.filter(
      (item) => item.id != null && !existingIds.has(item.id),
    )

    return {
      items: nextItems.length > 0 ? [...feed.items, ...nextItems] : feed.items,
      endReached: nextItems.length === 0,
    }
  })
  .on(deleteTimeMutation.finished.success, (feed, { params }) => {
    const deletedIds = new Set(params)

    return {
      ...feed,
      items: feed.items.filter((item) => !item.id || !deletedIds.has(item.id)),
    }
  })
  .on(editTimeMutation.finished.success, (feed, { params }) =>
    patchTimeItems(feed, [params.id], (item) => ({
      ...item,
      note: params.note,
      isPaid: params.isPaid,
    })),
  )
  .on(setTimePaidStatusMutation.finished.success, (feed, { params }) =>
    patchTimeItems(feed, params.ids, (item) => ({
      ...item,
      isPaid: params.isPaid,
    })),
  )
  .on(removeTimeScreenshotMutation.finished.success, (feed, { params }) =>
    patchTimeItems(feed, params, (item) => ({
      ...item,
      screenshot: undefined,
    })),
  )
  .on(removeTimeProcessesMutation.finished.success, (feed, { params }) =>
    patchTimeItems(feed, params, (item) => ({
      ...item,
      processes: [],
      apps: [],
    })),
  )
  // As the server answers: a phone entry says its location was removed.
  .on(removeTimeLocationsMutation.finished.success, (feed, { params }) =>
    patchTimeItems(feed, params, (item) => ({
      ...item,
      locations: [],
      locationStatus:
        item.source === 'mobile' ? 'removed' : item.locationStatus,
    })),
  )
  .reset(resetTimeFilters)

export const $allTime = $timeFeed.map((feed) => feed.items)

export const $hasMoreTime = combine(
  $timeFeed,
  $timeEntriesTotal,
  (feed, total) => !feed.endReached && feed.items.length < total,
)

export const $isLoadingMoreTime = createStore(false)
  .on(timeQuery.start, (_, params) => (params.page ?? 0) > 0 && !params.quiet)
  .on(timeQuery.finished.finally, (state, { params }) =>
    isFirstPage(params) ? state : false,
  )
  .reset(resetTimeFilters)

export const $isTimeFiltering = createStore(false)
  .on([$timeFilters, $timeSort], () => true)
  .on(timeQuery.finished.finally, () => false)

/** First-page failures have an inline retry; later failures keep the feed. */
export const $timeFailed = createStore(false)
  .on(timeQuery.start, (failed, params) =>
    isFirstPage(params) ? false : failed,
  )
  .on(timeQuery.finished.failure, (failed, { params }) =>
    isFirstPage(params) ? true : failed,
  )
  .on(timeQuery.finished.success, () => false)

export const $timeLoading = restore(setTimeLoading, false)
  .on(timeQuery.start, (state, params) => (isFirstPage(params) ? true : state))
  .on(timeQuery.finished.finally, (state, { params }) =>
    isFirstPage(params) ? false : state,
  )
