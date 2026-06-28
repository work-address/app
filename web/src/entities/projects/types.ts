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
  keyboardKeys: number
  mouseKeys: number
  mouseDistance: number
}

export type TimeTotalComputed = {
  hoursTotal: number
  minutesTotal: number
  hoursActiveTotal: number
  minutesActiveTotal: number
  earnings: number
}

export type ProjectWithStats = Omit<baseApi.Project, 'rateHour'> &
  TimeTotalsRow &
  TimeTotalComputed
