import { concurrency, createQuery } from '@farfetched/core'
import { endOfDay } from 'date-fns'

import type { Time, TimeSort } from './types'

import { baseApi, runApiData } from '@/shared'

export type TimeQueryParams = {
  activityId?: string
  note?: string
  fromAt?: number
  toAt?: number
  page?: number
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

export const timeQuery = createQuery({
  handler: async (params: TimeQueryParams) => {
    const [items, total] = (await runApiData(() =>
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
          page: params?.page ?? 0,
          sort: params?.sort ?? {},
        },
      }),
    )) as [Time[], number]

    return { items: items ?? [], total: Number(total ?? 0) }
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
export const timeAgentRunsQuery = createQuery({
  handler: async (params: TimeAgentRunsParams) => {
    const [runs] = (await runApiData(() =>
      baseApi.agentControllerSearch({ body: params }),
    )) as [TimeAgentRun[], number]

    return runs
  },
})

concurrency(timeAgentRunsQuery, { strategy: 'TAKE_LATEST' })

export type RecentTimeParams = {
  fromAt: string
  toAt: string
}

/**
 * The newest runs across every project the reader works on: their own, and
 * every worker's on projects they own. Prompts another worker has not yet
 * released come back held.
 */
export const recentAgentRunsQuery = createQuery({
  handler: async (params: RecentTimeParams) => {
    const [runs] = (await runApiData(() =>
      baseApi.agentControllerSearch({ body: params }),
    )) as [TimeAgentRun[], number]

    return runs
  },
})

concurrency(recentAgentRunsQuery, { strategy: 'TAKE_LATEST' })

/** How many entries to look through for the screenshot strip. */
const RECENT_SCREENSHOTS_PAGE = 48

/**
 * The newest entries with a screenshot the reader may see: the search applies
 * the review window and retention, so nothing held comes back.
 */
export const recentScreenshotsQuery = createQuery({
  handler: async (params: RecentTimeParams) => {
    const [items] = (await runApiData(() =>
      baseApi.timeControllerSearch({
        body: {
          filter: {
            withScreenshots: true,
            fromAt: params.fromAt,
            toAt: params.toAt,
          },
          page: 0,
          limit: RECENT_SCREENSHOTS_PAGE,
          sort: { fromAt: 'DESC' },
        },
      }),
    )) as [Time[], number]

    return items ?? []
  },
})

concurrency(recentScreenshotsQuery, { strategy: 'TAKE_LATEST' })

/** One page of the newest entries, and at most how many pages to read. */
const RECENT_TIME_PAGE = 100
const RECENT_TIME_PAGES = 10
/**
 * How far before a person's earliest entry so far to keep reading: a
 * session's ten-minute gap, plus an hour for an entry that started earlier
 * and ends inside that gap.
 */
const RECENT_TIME_REACH_MS = 70 * 60_000

export type RecentTimeOfUserParams = RecentTimeParams & { userId: string }

/** An entry's author: the search sends it, the generated type leaves it out. */
const authorOf = (entry: Time) =>
  (entry as Time & { user?: { id?: string } }).user?.id

/**
 * One person's newest entries in a period. The search takes no person, so
 * pages of everyone's entries are read newest first until that person's
 * latest stretch is behind, or the pages run out.
 */
export const recentTimeQuery = createQuery({
  handler: async ({ fromAt, toAt, userId }: RecentTimeOfUserParams) => {
    const mine: Time[] = []

    for (let page = 0; page < RECENT_TIME_PAGES; page++) {
      const [items] = (await runApiData(() =>
        baseApi.timeControllerSearch({
          body: {
            filter: { fromAt, toAt },
            page,
            limit: RECENT_TIME_PAGE,
            sort: { fromAt: 'DESC' },
          },
        }),
      )) as [Time[], number]
      const list = items ?? []

      mine.push(...list.filter((entry) => authorOf(entry) === userId))

      const oldest = list.at(-1)
      const earliestMine = Math.min(
        ...mine.map((entry) => Date.parse(entry.fromAt)),
      )

      if (
        list.length < RECENT_TIME_PAGE ||
        (mine.length > 0 &&
          oldest &&
          Date.parse(oldest.fromAt) < earliestMine - RECENT_TIME_REACH_MS)
      ) {
        break
      }
    }

    return mine
  },
})

concurrency(recentTimeQuery, { strategy: 'TAKE_LATEST' })
