import { createQuery } from '@farfetched/core'

import { normalizeProcessName } from './utils'

import type { ProjectProcessStats, StatsPeriod, TimeTotalsRow } from './types'

import { baseApi, suppressGlobalErrorToast } from '@/shared'

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

    return responses.flatMap(
      (response) => (response.data ?? []) as TimeTotalsRow[],
    )
  },
})

export const projectsProcessStatsQuery = createQuery({
  handler: async ({
    projectIds,
    period,
  }: {
    projectIds: string[]
    period: StatsPeriod
  }): Promise<ProjectProcessStats[]> => {
    if (projectIds.length === 0) {
      return []
    }

    const results = await Promise.allSettled(
      projectIds.map((id) => fetchProjectProcesses(id, period)),
    )

    // One project's failed stats should not blank the chart for the rest.
    return results.map((result, index) => ({
      projectId: projectIds[index],
      processes: result.status === 'fulfilled' ? result.value : [],
      failed: result.status === 'rejected',
    }))
  },
})

const fetchProjectProcesses = async (id: string, period: StatsPeriod) => {
  const response = await baseApi.projectControllerGetStats({
    path: { id: id as never, period },
  })

  if (response.error) {
    // The failure is aggregated into this project's `failed` flag and
    // surfaced once via showProcessStatsError, not per-project.
    suppressGlobalErrorToast(response.error)
    throw response.error
  }

  const stats = (response.data ?? []) as baseApi.ProjectStatisticsSearch[]

  return stats.map((stat) => ({
    processName: normalizeProcessName(stat.processName),
    timeMin: stat.timeMin ?? 0,
  }))
}
