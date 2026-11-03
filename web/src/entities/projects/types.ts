import type { baseApi } from '@/shared'

export type ProjectsFilter = {
  projectState: 'All' | 'Active' | 'Inactive'
  containsText: string
}

export type ProjectRole = NonNullable<baseApi.Project['role']>

/**
 * A project's all-time totals, as much of them as the reader may see. The API
 * leaves out a figure rather than sending null, so a viewer's row holds
 * `projectId` and `minutes` and nothing else.
 */
export type TimeTotalsRow = {
  projectId: string
  minutes: number
  rateHour?: number
  minutesActive?: number
  /** Minutes marked paid, by an invoice or by their author by hand. */
  minutesPaid?: number
  /** Minutes not marked paid. */
  minutesUnpaid?: number
  keyboardKeys?: number
  mouseKeys?: number
  mouseDistance?: number
  /** All the tracked time at the project's rate. */
  earnedCents?: number
  /**
   * What has been paid for: paid invoices as billed, and time marked paid by
   * hand at the project's rate, which is an estimate until it is invoiced.
   */
  paidCents?: number
  /** The minutes not marked paid, at the project's rate. */
  unpaidCents?: number
}

export type TimeTotalComputed = {
  hoursTotal: number
  minutesTotal: number
  hoursActiveTotal: number
  minutesActiveTotal: number
}

export type ProjectWithStats = Omit<baseApi.Project, 'rateHour' | 'role'> &
  TimeTotalsRow &
  TimeTotalComputed & {
    /** What the project's lists say the reader is; unrelated to `canTrack`. */
    role: ProjectRole
  }

export type StatsPeriod = NonNullable<baseApi.ProjectStatisticsSearch['period']>

export type ProjectProcessStat = {
  processName: string
  timeMin: number
}

export type ProjectProcessStats = {
  projectId: string
  processes: ProjectProcessStat[]
  failed: boolean
}
