import { bucketKeyOf, type BucketSize } from './period-buckets'

import type {
  StatisticsAgentDailyRow,
  StatisticsDailyRow,
} from '@/entities/statistics'

type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type AgentSplit = {
  assisted: number
  autonomous: number
  waiting: number
}

/** Everything known about one bar of a chart, in minutes. */
export type BucketBreakdown = {
  peopleMinutes: number
  /** Tracked minutes per project, most first. */
  projects: { projectId: string; minutes: number }[]
  agents: AgentSplit
  /** Agent minutes per product, most first; waiting kept apart. */
  products: ({ product: string } & AgentSplit)[]
}

const EMPTY: BucketBreakdown = {
  peopleMinutes: 0,
  projects: [],
  agents: { assisted: 0, autonomous: 0, waiting: 0 },
  products: [],
}

/**
 * Human time by project and agent time by product, per bar, so either chart
 * can say everything about the bar under the pointer - not only the series
 * it draws.
 */
export function bucketBreakdowns(
  daily: StatisticsDailyRow[],
  agents: StatisticsAgentDailyRow[],
  size: BucketSize,
  weekStartsOn: WeekStart,
): Map<string, BucketBreakdown> {
  const projects = new Map<string, Map<string, number>>()
  const products = new Map<string, Map<string, AgentSplit>>()

  for (const row of daily) {
    const key = bucketKeyOf(row.day, size, weekStartsOn)
    const bucket = projects.get(key) ?? new Map<string, number>()

    bucket.set(
      row.projectId,
      (bucket.get(row.projectId) ?? 0) + row.trackedSeconds / 60,
    )
    projects.set(key, bucket)
  }

  for (const row of agents) {
    const key = bucketKeyOf(row.day, size, weekStartsOn)
    const bucket = products.get(key) ?? new Map<string, AgentSplit>()
    const split = bucket.get(row.product) ?? {
      assisted: 0,
      autonomous: 0,
      waiting: 0,
    }

    split.assisted += row.assistedSeconds / 60
    split.autonomous += row.autonomousSeconds / 60
    split.waiting += row.waitSeconds / 60
    bucket.set(row.product, split)
    products.set(key, bucket)
  }

  const out = new Map<string, BucketBreakdown>()

  for (const key of new Set([...projects.keys(), ...products.keys()])) {
    const projectRows = [...(projects.get(key) ?? [])]
      .map(([projectId, minutes]) => ({ projectId, minutes }))
      .sort((a, b) => b.minutes - a.minutes)
    const productRows = [...(products.get(key) ?? [])]
      .map(([product, split]) => ({ product, ...split }))
      .sort(
        (a, b) =>
          b.assisted + b.autonomous - (a.assisted + a.autonomous) ||
          a.product.localeCompare(b.product),
      )

    out.set(key, {
      peopleMinutes: projectRows.reduce((sum, p) => sum + p.minutes, 0),
      projects: projectRows,
      agents: productRows.reduce(
        (sum, p) => ({
          assisted: sum.assisted + p.assisted,
          autonomous: sum.autonomous + p.autonomous,
          waiting: sum.waiting + p.waiting,
        }),
        { ...EMPTY.agents },
      ),
      products: productRows,
    })
  }

  return out
}

export const emptyBreakdown = (): BucketBreakdown => ({
  ...EMPTY,
  agents: { ...EMPTY.agents },
})
