import type { ITimeTotal } from '@/entities/time'
import type { baseApi } from '@/shared'

export type ProjectInvoice = baseApi.Project & {
  report?: ITimeTotal
  totalAmount: number
}
