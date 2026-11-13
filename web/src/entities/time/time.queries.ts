import { concurrency, createQuery } from '@farfetched/core'
import { endOfDay } from 'date-fns'

import type { Time, TimeSort } from './types'

import { baseApi, runApiData, type FailureReport } from '@/shared'

export type TimeQueryParams = {
  activityId?: string
  note?: string
  fromAt?: number
  toAt?: number
  page?: number
  /**
   * Read every page up to this one again and replace the list with them: after
   * rows leave, the pages already loaded no longer line up with the server's.
   */
  reloadThroughPage?: number
  /** Nobody asked for this read, so it shows no progress and no failure. */
  quiet?: boolean
  sort?: TimeSort
  timeActiveMin?: number | null
  timeActiveMax?: number | null
  keyboardKeysMin?: number | null
  keyboardKeysMax?: number | null
  mouseKeysMin?: number | null
  mouseKeysMax?: number | null
  mouseDistanceMin?: number | null
  mouseDistanceMax?: number | null
}

const toDateTime = (ms?: number, endOfSelectedDay = false) => {
  if (ms == null) {
    return
  }

  const date = new Date(ms)

  return (endOfSelectedDay ? endOfDay(date) : date).toISOString()
}

const toFilterNumber = (value?: number | null | string) => {
  if (value == null || value === '') {
    return
  }

  const parsed = Number(value)

  return Number.isNaN(parsed) ? undefined : parsed
}

/**
 * A first page fails in place: the worklogs section shows it, with a retry. So
 * does a read nobody asked for, such as the reload after a delete: the rows on
 * screen are right, and the next "load more" reads them again. Only a later
 * page the person asked for has nowhere to say so but a toast.
 */
const timeFailureReport = (params: TimeQueryParams): FailureReport =>
  (params.page ?? 0) === 0 || params.quiet
    ? 'in-place'
    : { fixed: 'dashboard.worklogsTable.loadMoreError' }

const searchTimePage = async (params: TimeQueryParams, page: number) => {
  const [items, total] = (await runApiData(
    () =>
      baseApi.timeControllerSearch({
        body: {
          filter: {
            projectId: params?.activityId,
            fromAt: toDateTime(params?.fromAt),
            toAt: toDateTime(params?.toAt, true),
            note: params.note,
            minutesActiveFrom: toFilterNumber(params.timeActiveMin),
            minutesActiveTo: toFilterNumber(params.timeActiveMax),
            keyboardKeysFrom: toFilterNumber(params.keyboardKeysMin),
            keyboardKeysTo: toFilterNumber(params.keyboardKeysMax),
            mouseKeysFrom: toFilterNumber(params.mouseKeysMin),
            mouseKeysTo: toFilterNumber(params.mouseKeysMax),
            mouseDistanceFrom: toFilterNumber(params.mouseDistanceMin),
            mouseDistanceTo: toFilterNumber(params.mouseDistanceMax),
          },
          page,
          sort: params?.sort ?? {},
        },
      }),
    timeFailureReport(params),
  )) as [Time[], number]

  return { items: items ?? [], total: Number(total ?? 0) }
}

export const timeQuery = createQuery({
  handler: async (params: TimeQueryParams) => {
    if (params.reloadThroughPage === undefined) {
      return searchTimePage(params, params?.page ?? 0)
    }

    const byId = new Map<string, Time>()
    let total = 0

    for (let page = 0; page <= params.reloadThroughPage; page += 1) {
      const result = await searchTimePage(params, page)

      total = result.total
      for (const item of result.items) {
        if (item.id) {
          byId.set(item.id, item)
        }
      }
      if (result.items.length === 0) {
        break
      }
    }

    return { items: [...byId.values()], total }
  },
})

// Pagination reads the previous page from the store, so a stale response must
// never land after a newer one.
concurrency(timeQuery, { strategy: 'TAKE_LATEST' })

/** An agent run as /agent-tracking/search returns it; the fields the entry dialog shows. */
export type TimeAgentRun = {
  /** Not sent by the API; `runKey` names the run. */
  id?: string
  /** Unique per run: what a list keys its runs by. */
  runKey: string
  userId: string
  projectId: string
  product: string
  /** Where the agent ran: `cli`, `ide`, `desktop`... */
  surface?: string
  fromAt: string
  toAt: string
  status: string
  /** The run's timeline; `untracked` is time the timer was paused. */
  segments?: TimeAgentSegment[]
  /** The text that started the run, when its collector sent it. */
  prompt?: string | null
  /** Another worker's prompt, held until their review window passes. */
  promptPendingReview?: boolean
  isPaid?: boolean
  invoiceId?: string | null
}

export type TimeAgentSegment = {
  fromAt: string
  toAt: string
  state: 'running' | 'human_wait' | 'unknown' | 'untracked'
}

export type TimeAgentRunsParams = {
  projectId: string
  fromAt: string
  toAt: string
}

/** The project's agent runs that overlap an entry: everyone's for its owner, one's own otherwise. */
// A project without agent tracking, or a viewer, has none to show: the dialog
// simply leaves the section out.
export const timeAgentRunsQuery = createQuery({
  handler: async (params: TimeAgentRunsParams) => {
    const [runs] = (await runApiData(
      () => baseApi.agentControllerSearch({ body: params }),
      'in-place',
    )) as [TimeAgentRun[], number]

    return runs
  },
})

concurrency(timeAgentRunsQuery, { strategy: 'TAKE_LATEST' })

export type RecentTimeParams = {
  fromAt: string
  toAt: string
}

// The three reads below fail in place: the dashboard's strips show their own
// failure.

/**
 * The newest runs across every project the reader works on: their own, and
 * every worker's on projects they own. Prompts another worker has not yet
 * released come back held.
 */
export const recentAgentRunsQuery = createQuery({
  handler: async (params: RecentTimeParams) => {
    const [runs] = (await runApiData(
      () => baseApi.agentControllerSearch({ body: params }),
      'in-place',
    )) as [TimeAgentRun[], number]

    return runs
  },
})

concurrency(recentAgentRunsQuery, { strategy: 'TAKE_LATEST' })

/** A period narrowed to some projects and people; empty means all of them. */
export type RecentEntriesParams = RecentTimeParams & {
  projectIds: string[]
  userIds: string[]
}

/** How many screenshots the strip shows. */
const RECENT_SCREENSHOTS_PAGE = 8

/**
 * The newest entries with a screenshot the reader may see: the search applies
 * the review window and retention, so nothing held comes back.
 */
export const recentScreenshotsQuery = createQuery({
  handler: async ({
    fromAt,
    toAt,
    projectIds,
    userIds,
  }: RecentEntriesParams) => {
    const [items] = (await runApiData(
      () =>
        baseApi.timeControllerSearch({
          body: {
            filter: {
              withScreenshots: true,
              fromAt,
              toAt,
              projectIds,
              userIds,
            },
            page: 0,
            limit: RECENT_SCREENSHOTS_PAGE,
            sort: { fromAt: 'DESC' },
          },
        }),
      'in-place',
    )) as [Time[], number]

    return items ?? []
  },
})

concurrency(recentScreenshotsQuery, { strategy: 'TAKE_LATEST' })

/** Enough of someone's newest entries to hold their latest session. */
const RECENT_TIME_PAGE = 100

export type RecentDesktopTimeParams = RecentTimeParams & {
  projectIds: string[]
  userId: string
}

/**
 * One person's newest entries in a period, on these projects. The session
 * model keeps the desktop app's and the phone's: the filter takes one source.
 */
export const recentTimeQuery = createQuery({
  handler: async ({
    fromAt,
    toAt,
    projectIds,
    userId,
  }: RecentDesktopTimeParams) => {
    const [items] = (await runApiData(
      () =>
        baseApi.timeControllerSearch({
          body: {
            filter: {
              fromAt,
              toAt,
              projectIds,
              userIds: [userId],
            },
            page: 0,
            limit: RECENT_TIME_PAGE,
            sort: { fromAt: 'DESC' },
          },
        }),
      'in-place',
    )) as [Time[], number]

    return items ?? []
  },
})

concurrency(recentTimeQuery, { strategy: 'TAKE_LATEST' })
