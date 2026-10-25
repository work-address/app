/** What every statistics route takes; `to` is exclusive. */
export type StatisticsQuery = {
  /** Omitted: every project the caller can see. */
  projectIds?: string[]
  userIds?: string[]
  from: string
  to: string
  timeZone: string
  /** How `time/daily` and `agents/daily` cut the period. */
  bucket?: 'day' | 'hour'
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

/** Tracked seconds on one project on one of the reader's days. */
export type StatisticsDailyRow = {
  day: string
  projectId: string
  trackedSeconds: number
}

/** The reader's active seconds in one weekday-and-hour cell. */
export type StatisticsHourlyRow = {
  /** ISO weekday: 1 is Monday. */
  weekday: number
  hour: number
  activeSeconds: number
}

/** Figures about the reader alone, whoever the people filter selects. */
export type StatisticsInsights = {
  focus: { count: number; minutes: number; longestMinutes: number }
  /** Hours of the day, best first. */
  productiveHours: number[]
  /** Active share of measured time, 0-1; null with nothing measured. */
  activeRatio: number | null
  keysPerActiveHour: number | null
  clicksPerActiveHour: number | null
}

export type StatisticsAgentDailyRow = {
  day: string
  product: string
  assistedSeconds: number
  autonomousSeconds: number
  waitSeconds: number
}

export type StatisticsAgentRunCount = {
  product: string
  status: string
  count: number
}

export type StatisticsAgents = {
  daily: StatisticsAgentDailyRow[]
  runs: StatisticsAgentRunCount[]
}

/** One person's time on the reader's own projects. */
export type StatisticsTeamRow = {
  userId: string
  name: string
  trackedSeconds: number
  activeSeconds: number
  unpaidSeconds: number
  agentSeconds: number
}
