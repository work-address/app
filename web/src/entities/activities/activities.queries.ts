import { createQuery } from '@farfetched/core'

import type { ITimeTotalDetail, WorklogSort } from './types'
import type { ITimeTotal } from './types'

import { baseApi } from '@/shared'

export const activityDetailQuery = createQuery({
  handler: async (id: string) => {
    const response = await baseApi.activityControllerRead({
      path: { id: id as never },
    })

    return response.data as baseApi.Activity
  },
})

export const activityReportQuery = createQuery({
  handler: async (id: string) => {
    const response = await baseApi.timeControllerGetReport({
      path: { id: id as never },
    })

    return response.data as { time: ITimeTotalDetail[]; totals: ITimeTotal[] }
  },
})

export const activitiesQuery = createQuery({
  handler: async ({
    page = 0,
    limit = 50,
  }: { page?: number; limit?: number } = {}) => {
    const response = await baseApi.activityControllerSearchFreelancer({
      body: {
        filter: {
          query: 'test',
        },
        page,
        sort: { createdAt: 'DESC' },
        limit,
      },
    })

    return {
      items: (response.data?.[0] as baseApi.Activity[]) ?? [],
      total: (response.data?.[1] as number) ?? 0,
    }
  },
})

export const activitiesStatsQuery = createQuery({
  handler: async (): Promise<ITimeTotal[]> => {
    const response = await baseApi.timeControllerGetTotals()

    return response.data as ITimeTotal[]
  },
})

export type WorklogsQueryParams = {
  activityId?: string
  note?: string
  fromAt?: number
  toAt?: number
  page?: number
  sort?: WorklogSort
}

export const worklogsQuery = createQuery({
  handler: async (params: WorklogsQueryParams) => {
    const response = await baseApi.timeControllerSearchFreelancer({
      body: {
        filter: {
          activityId: params?.activityId,
          fromAt: params?.fromAt,
          toAt: params?.toAt,
          note: params.note,
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
