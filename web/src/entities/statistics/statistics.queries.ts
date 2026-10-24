import { concurrency, createQuery } from '@farfetched/core'

import type {
  StatisticsProjectAppRow,
  StatisticsQuery,
  StatisticsTotalsRow,
} from './types'

import { baseApi, runApiData, suppressGlobalErrorToast } from '@/shared'

// Raw SQL sums arrive as strings.
const toNumber = (value: unknown) =>
  value == null ? undefined : Number(value) || 0

const run = async <T>(request: () => Promise<unknown>): Promise<T> => {
  try {
    return (await runApiData(request as never)) as T
  } catch (error) {
    // Each widget shows its own failure and retry.
    suppressGlobalErrorToast(error)
    throw error
  }
}

export const statisticsOverviewQuery = createQuery({
  handler: async (query: StatisticsQuery): Promise<StatisticsTotalsRow[]> => {
    const { totals } = await run<{ totals: Record<string, unknown>[] }>(() =>
      baseApi.statisticsControllerOverview({ body: query }),
    )

    return totals.map((row) => ({
      projectId: String(row.projectId),
      trackedSeconds: toNumber(row.trackedSeconds) ?? 0,
      activeSeconds: toNumber(row.activeSeconds),
      idleSeconds: toNumber(row.idleSeconds),
      manualSeconds: toNumber(row.manualSeconds),
      paidSeconds: toNumber(row.paidSeconds),
    }))
  },
})

concurrency(statisticsOverviewQuery, { strategy: 'TAKE_LATEST' })

export const statisticsProjectAppsQuery = createQuery({
  handler: async (
    query: StatisticsQuery,
  ): Promise<StatisticsProjectAppRow[]> => {
    const { rows } = await run<{ rows: Record<string, unknown>[] }>(() =>
      baseApi.statisticsControllerApps({
        path: { kind: 'projects' },
        body: query,
      }),
    )

    return rows.map((row) => ({
      projectId: String(row.projectId),
      app: String(row.app ?? ''),
      seconds: toNumber(row.seconds) ?? 0,
    }))
  },
})

concurrency(statisticsProjectAppsQuery, { strategy: 'TAKE_LATEST' })
