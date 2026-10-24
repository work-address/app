import { concurrency, createQuery } from '@farfetched/core'

import type {
  StatisticsAgents,
  StatisticsDailyRow,
  StatisticsHourlyRow,
  StatisticsInsights,
  StatisticsProjectAppRow,
  StatisticsQuery,
  StatisticsTeamRow,
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

const overviewHandler = async (
  query: StatisticsQuery,
): Promise<StatisticsTotalsRow[]> => {
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
}

export const statisticsOverviewQuery = createQuery({ handler: overviewHandler })

concurrency(statisticsOverviewQuery, { strategy: 'TAKE_LATEST' })

/** The same totals for the period before, which the KPI deltas compare with. */
export const statisticsPreviousOverviewQuery = createQuery({
  handler: overviewHandler,
})

concurrency(statisticsPreviousOverviewQuery, { strategy: 'TAKE_LATEST' })

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

export const statisticsDailyQuery = createQuery({
  handler: async (query: StatisticsQuery): Promise<StatisticsDailyRow[]> => {
    const { rows } = await run<{ rows: StatisticsDailyRow[] }>(() =>
      baseApi.statisticsControllerTimeDaily({ body: query }),
    )

    return rows
  },
})

concurrency(statisticsDailyQuery, { strategy: 'TAKE_LATEST' })

export const statisticsHourlyQuery = createQuery({
  handler: async (query: StatisticsQuery): Promise<StatisticsHourlyRow[]> => {
    const { rows } = await run<{ rows: StatisticsHourlyRow[] }>(() =>
      baseApi.statisticsControllerTimeHourly({ body: query }),
    )

    return rows
  },
})

concurrency(statisticsHourlyQuery, { strategy: 'TAKE_LATEST' })

export const statisticsInsightsQuery = createQuery({
  handler: async (query: StatisticsQuery): Promise<StatisticsInsights> =>
    run<StatisticsInsights>(() =>
      baseApi.statisticsControllerInsightsMe({ body: query }),
    ),
})

concurrency(statisticsInsightsQuery, { strategy: 'TAKE_LATEST' })

export const statisticsAgentsQuery = createQuery({
  handler: async (query: StatisticsQuery): Promise<StatisticsAgents> =>
    run<StatisticsAgents>(() =>
      baseApi.statisticsControllerAgentsDaily({ body: query }),
    ),
})

concurrency(statisticsAgentsQuery, { strategy: 'TAKE_LATEST' })

export const statisticsTeamQuery = createQuery({
  handler: async (query: StatisticsQuery): Promise<StatisticsTeamRow[]> => {
    const { rows } = await run<{ rows: StatisticsTeamRow[] }>(() =>
      baseApi.statisticsControllerTeam({ body: query }),
    )

    return rows
  },
})

concurrency(statisticsTeamQuery, { strategy: 'TAKE_LATEST' })
