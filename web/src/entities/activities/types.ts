import type { baseApi } from '@/features/shared'

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
