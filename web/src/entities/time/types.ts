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

export type Time = Omit<baseApi.Time, 'invoiceId'> & {
  project?: baseApi.Project
  /**
   * The invoice that bills this entry, or null. Sent by the search endpoint
   * (read-only, API `Time.invoiceId`). Redeclared over the generated type,
   * which leaves out the null the API sends for an entry on no invoice. Once
   * set, the entry's payment follows the invoice and the API refuses to
   * change it directly.
   */
  invoiceId?: string | null
}

export type TimeFilters = {
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

export type TimeSort = Record<string, 'ASC' | 'DESC'>
