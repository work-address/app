import { createQuery } from '@farfetched/core'

import { normalizeProcessName } from './utils'

import type { ProjectProcessStats, StatsPeriod, TimeTotalsRow } from './types'

import { baseApi, runApiData, suppressGlobalErrorToast } from '@/shared'

export const projectsQuery = createQuery({
  handler: async ({
    page = 0,
    limit = 50,
  }: { page?: number; limit?: number } = {}) => {
    // `runApiData` rejects on failure. Reading `.data?.[0] ?? []` instead
    // turned a 500 or a dropped connection into an empty list, and the
    // dashboard then offered a new account's "create your first project".
    const [items, total] = (await runApiData(() =>
      baseApi.projectControllerSearch({
        body: {
          filter: {},
          page,
          sort: { createdAt: 'DESC' },
          limit,
        },
      }),
    )) as [baseApi.Project[], number]

    return { items: items ?? [], total: total ?? 0 }
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

// Kept separate from projectsProcessStatsQuery so the project dialog can load
// one project's apps without overwriting the dashboard chart's data.
export const projectProcessStatsQuery = createQuery({
  handler: async ({
    projectId,
    period,
  }: {
    projectId: string
    period: StatsPeriod
  }): Promise<ProjectProcessStats> => {
    try {
      return {
        projectId,
        processes: await fetchProjectProcesses(projectId, period),
        failed: false,
      }
    } catch {
      return { projectId, processes: [], failed: true }
    }
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
