import { combine, createStore, restore } from 'effector'

import {
  changeWorklogFilters,
  appendWorklogSort,
  resetWorklogFilters,
  resetWorklogSort,
  setWorklogsLoading,
  applyWorklogFilters,
  fetchWorklogs,
} from './time.events'
import {
  deleteWorklogMutation,
  editWorklogMutation,
  removeWorklogProcessesMutation,
  removeWorklogScreenshotMutation,
  setWorklogPaidStatusMutation,
} from './time.mutations'
import { worklogsQuery, type WorklogsQueryParams } from './time.queries'

import type { Time, WorklogsFilters, WorklogSort } from './types'

const DEFAULT_WORKLOGS_FILTERS: WorklogsFilters = {
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

const isFirstPage = (params: WorklogsQueryParams) => (params.page ?? 0) === 0

type WorklogsFeed = {
  items: Time[]
  /** Set once a page comes back without adding anything new. */
  endReached: boolean
}

const EMPTY_FEED: WorklogsFeed = { items: [], endReached: false }

const patchWorklogs = (
  feed: WorklogsFeed,
  ids: string[],
  patch: (item: Time) => Time,
): WorklogsFeed => {
  const targetIds = new Set(ids)

  return {
    ...feed,
    items: feed.items.map((item) =>
      item.id && targetIds.has(item.id) ? patch(item) : item,
    ),
  }
}

export const $worklogsFilters = createStore<WorklogsFilters>(
  DEFAULT_WORKLOGS_FILTERS,
)
  .on(changeWorklogFilters, (state, filters) => ({ ...state, ...filters }))
  .reset(resetWorklogFilters)

export const $hasActiveWorklogFilters = $worklogsFilters.map((filters) =>
  (Object.keys(DEFAULT_WORKLOGS_FILTERS) as (keyof WorklogsFilters)[]).some(
    (key) => filters[key] !== DEFAULT_WORKLOGS_FILTERS[key],
  ),
)

export const $worklogSort = createStore<WorklogSort>({ fromAt: 'DESC' })
  .on(appendWorklogSort, (state, sort) => ({ ...state, ...sort }))
  .on(resetWorklogSort, (_, payload) => payload ?? { fromAt: 'DESC' })

export const $worklogsPage = createStore(0)
  .on(worklogsQuery.finished.success, (_, { params }) => params.page ?? 0)
  .on([applyWorklogFilters, fetchWorklogs, resetWorklogFilters], () => 0)

export const $worklogsTotal = createStore(0)
  .on(worklogsQuery.finished.success, (_, { result }) => result.total)
  .on(deleteWorklogMutation.finished.success, (total, { params }) =>
    Math.max(0, total - params.length),
  )
  .reset(resetWorklogFilters)

/**
 * Accumulates the pages loaded so far. Mutations patch the loaded rows in
 * place instead of refetching, so an edit does not throw away the pages the
 * user has already scrolled through.
 */
const $worklogsFeed = createStore<WorklogsFeed>(EMPTY_FEED)
  .on(worklogsQuery.finished.success, (feed, { params, result }) => {
    const { items } = result

    if (isFirstPage(params)) {
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
  .on(deleteWorklogMutation.finished.success, (feed, { params }) => {
    const deletedIds = new Set(params)

    return {
      ...feed,
      items: feed.items.filter((item) => !item.id || !deletedIds.has(item.id)),
    }
  })
  .on(editWorklogMutation.finished.success, (feed, { params }) =>
    patchWorklogs(feed, [params.id], (item) => ({
      ...item,
      note: params.note,
      isPaid: params.isPaid,
    })),
  )
  .on(setWorklogPaidStatusMutation.finished.success, (feed, { params }) =>
    patchWorklogs(feed, params.ids, (item) => ({
      ...item,
      isPaid: params.isPaid,
    })),
  )
  .on(removeWorklogScreenshotMutation.finished.success, (feed, { params }) =>
    patchWorklogs(feed, params, (item) => ({ ...item, screenshot: undefined })),
  )
  .on(removeWorklogProcessesMutation.finished.success, (feed, { params }) =>
    patchWorklogs(feed, params, (item) => ({ ...item, processes: [] })),
  )
  .reset(resetWorklogFilters)

export const $allWorklogs = $worklogsFeed.map((feed) => feed.items)

export const $hasMoreWorklogs = combine(
  $worklogsFeed,
  $worklogsTotal,
  (feed, total) => !feed.endReached && feed.items.length < total,
)

export const $isLoadingMoreWorklogs = createStore(false)
  .on(worklogsQuery.start, (_, params) => !isFirstPage(params))
  .on(worklogsQuery.finished.finally, (state, { params }) =>
    isFirstPage(params) ? state : false,
  )
  .reset(resetWorklogFilters)

export const $isWorklogsFiltering = createStore(false)
  .on([$worklogsFilters, $worklogSort], () => true)
  .on(worklogsQuery.finished.finally, () => false)

export const $worklogsLoading = restore(setWorklogsLoading, false)
  .on(worklogsQuery.start, (state, params) =>
    isFirstPage(params) ? true : state,
  )
  .on(worklogsQuery.finished.finally, (state, { params }) =>
    isFirstPage(params) ? false : state,
  )
