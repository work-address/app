import { createQuery } from '@farfetched/core'

import type { TimeTotalsRow, WorklogSort } from './types'

import { baseApi } from '@/shared'

export const activitiesQuery = createQuery({
  handler: async ({
    page = 0,
    limit = 50,
  }: { page?: number; limit?: number } = {}) => {
    const response = await baseApi.projectControllerSearch({
      body: {
        filter: {},
        page,
        sort: { createdAt: 'DESC' },
        limit,
      },
    })

    return {
      items: (response.data?.[0] as baseApi.Project[]) ?? [],
      total: (response.data?.[1] as number) ?? 0,
    }
  },
})

export const activitiesStatsQuery = createQuery({
  handler: async (projectIds: string[]): Promise<TimeTotalsRow[]> => {
    if (projectIds.length === 0) {
      return []
    }

    const responses = await Promise.all(
      projectIds.map((id) =>
        baseApi.timeControllerGetTotals({
          path: { id: id as never },
        }),
      ),
    )

    return responses.flatMap(
      (response) => (response.data ?? []) as TimeTotalsRow[],
    )
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
    const response = await baseApi.timeControllerSearch({
      body: {
        filter: {
          projectId: params?.activityId,
          fromAt: params?.fromAt?.toString().slice(0, -3),
          toAt: params?.toAt?.toString().slice(0, -3),
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
