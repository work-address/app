import type { baseApi } from '@/shared'

export type ProjectsFilter = {
  projectState: 'All' | 'Active' | 'Inactive'
  containsText: string
}

export type TimeTotalsRow = {
  projectId: string
  rateHour: number
  rateTotal: number
  minutes: number
  minutesActive: number
  /** Active minutes covered by a settled invoice. */
  minutesPaid: number
  /** Active minutes not yet covered by a settled invoice. */
  minutesUnpaid: number
  keyboardKeys: number
  mouseKeys: number
  mouseDistance: number
}

export type TimeTotalComputed = {
  hoursTotal: number
  minutesTotal: number
  hoursActiveTotal: number
  minutesActiveTotal: number
  /**
   * What has actually been paid for on this project, in currency units.
   *
   * Derived from `minutesPaid` - hours covered by a settled invoice - not from
   * total tracked time. The column previously read "Earnings" while showing
   * everything tracked, which is money hoped for rather than money received.
   */
  paid: number
}

export type ProjectWithStats = Omit<baseApi.Project, 'rateHour'> &
  TimeTotalsRow &
  TimeTotalComputed

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
