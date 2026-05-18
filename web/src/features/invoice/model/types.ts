import type { ITimeTotal } from '@/entities/activities'
import type { baseApi } from '@/shared'

export type ProjectInvoice = baseApi.Project & {
  report?: ITimeTotal
  totalAmount: number
}
