import type { baseApi } from '@/shared'

export type ActivityStateFilter = 'all' | 'Active' | 'Finished'

export type ITimeTotal = {
  activityId: string
  rateHour: number
  rateTotal: number
  minutes: number
  minutesActive: number
  keyboardKeys: number
  mouseKeys: number
  mouseDistance: number
}

export type ITimeTotalDetail = {
  createdAt: string
  note: string
  fromAt: string
  toAt: string
  id: string
} & ITimeTotal

export type ITimeTotalComputed = {
  hoursTotal: number
  minutesTotal: number
  hoursActiveTotal: number
  minutesActiveTotal: number
  earnings: number
}

export type ProjectWithStats = Omit<baseApi.Activity, 'rateHour'> &
  ITimeTotal &
  ITimeTotalComputed

export type ProjectInvoice = baseApi.Activity & {
  report?: ITimeTotal
  totalAmount: number
}

export type Time = baseApi.Time & {
  activity?: baseApi.Activity
}

export type WorklogsFilters = {
  page: number
  fromAt: number | null
  toAt: number | null
  activityId: string | null
  note: string | null
  timeActiveMin: number | null
  timeActiveMax: number | null
  keyboardKeysMin: number | null
  keyboardKeysMax: number | null
  mouseKeysMin: number | null
  mouseKeysMax: number | null
  mouseDistanceMin: number | null
  mouseDistanceMax: number | null
}

export type WorklogSort = Record<string, 'ASC' | 'DESC'>
