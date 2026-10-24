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
