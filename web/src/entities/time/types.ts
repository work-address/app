import type { baseApi } from '@/shared'

export type ITimeTotal = {
  activityId: string
  rateHour: number
  rateTotal: number
  minutes: number
  minutesActive: number
  minutesPaid: number
  minutesUnpaid: number
  keyboardKeys: number
  mouseKeys: number
  mouseDistance: number
}

export type TimeTotalDetail = {
  createdAt: string
  note: string
  fromAt: string
  toAt: string
  id: string
} & ITimeTotal

export type Time = baseApi.Time & {
  project?: baseApi.Project
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
