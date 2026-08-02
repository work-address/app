import { createQuery } from '@farfetched/core'
import { endOfDay } from 'date-fns'

import type { WorklogSort } from './types'

import { baseApi } from '@/shared'

export type WorklogsQueryParams = {
  activityId?: string
  note?: string
  fromAt?: number
  toAt?: number
  page?: number
  sort?: WorklogSort
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

export const worklogsQuery = createQuery({
  handler: async (params: WorklogsQueryParams) => {
    const response = await baseApi.timeControllerSearch({
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
    })

    return {
      items: (response.data?.[0] ?? []) as baseApi.Time[],
      total: (response.data?.[1] ?? 0) as number,
    }
  },
})
