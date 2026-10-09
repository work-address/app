import { concurrency, createQuery } from '@farfetched/core'

import { normalizeProcessName } from './utils'

import type { ProjectProcessStats, StatsPeriod, TimeTotalsRow } from './types'

import {
  baseApi,
  collectSearchPages,
  runApiData,
  suppressGlobalErrorToast,
} from '@/shared'

export const projectsQuery = createQuery({
  handler: async () => {
    // Unique id order keeps tied creation dates stable across every page.
    const items = await collectSearchPages<baseApi.Project>(
      async (page, limit) =>
        (await runApiData(() =>
          baseApi.projectControllerSearch({
            body: { filter: {}, page, sort: { id: 'ASC' }, limit },
          }),
        )) as [baseApi.Project[], number],
    )

    // Preserve the dashboard's newest-first presentation after collecting.
    items.sort(
      (a, b) =>
        (b.createdAt ?? '').localeCompare(a.createdAt ?? '') ||
        (a.id ?? '').localeCompare(b.id ?? ''),
    )
    return { items, total: items.length }
  },
})

concurrency(projectsQuery, { strategy: 'TAKE_LATEST' })

export const projectsStatsQuery = createQuery({
  handler: async (projectIds: string[]): Promise<TimeTotalsRow[]> => {
    if (projectIds.length === 0) {
      return []
    }

    const responses = await Promise.all(
      projectIds.map(async (id) => {
        try {
          return (await runApiData(() =>
            baseApi.timeControllerGetTotals({ path: { id: id as never } }),
          )) as TimeTotalsRow[]
        } catch (error) {
          // Every request belongs to the same inline failure, including
          // rejections arriving after Promise.all has already failed.
          suppressGlobalErrorToast(error)
          throw error
        }
      }),
    )

    return responses.flat()
  },
})

concurrency(projectsStatsQuery, { strategy: 'TAKE_LATEST' })

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
