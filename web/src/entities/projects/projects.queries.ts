import { createQuery } from '@farfetched/core'

import type { TimeTotalsRow } from './types'

import { baseApi } from '@/shared'

export const projectsQuery = createQuery({
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

export const projectsStatsQuery = createQuery({
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

    return responses.flatMap((response) => {
      const rows = (response.data ?? []) as TimeTotalsRow[]

      return rows.map((row) => ({
        activityId: row.projectId,
        rateHour: row.rateHour,
        rateTotal: row.rateTotal,
        minutes: row.minutes,
        minutesActive: row.minutesActive,
        keyboardKeys: row.keyboardKeys,
        mouseKeys: row.mouseKeys,
        mouseDistance: row.mouseDistance,
      }))
    })
  },
})
