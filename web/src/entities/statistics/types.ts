/** What every statistics route takes; `to` is exclusive. */
export type StatisticsQuery = {
  /** Omitted: every project the caller can see. */
  projectIds?: string[]
  userIds?: string[]
  from: string
  to: string
  timeZone: string
}

/**
 * One project's time in the period. The detail fields are missing for a
 * project the caller only views - the API leaves them out rather than
 * sending zeros.
 */
export type StatisticsTotalsRow = {
  projectId: string
  trackedSeconds: number
  activeSeconds?: number
  idleSeconds?: number
  manualSeconds?: number
  paidSeconds?: number
}

/** Seconds spent in one app on one project. */
export type StatisticsProjectAppRow = {
  projectId: string
  app: string
  seconds: number
}
