import type { ITimeTotal } from '@/entities/time'
import type { baseApi } from '@/shared'

export type ProjectInvoice = baseApi.Project & {
  report?: ITimeTotal
  /** The persisted invoice: period, amount, state, issuer. */
  record: baseApi.InvoiceSearch
  /** `record.amountCents` in currency units. Never recomputed from time. */
  totalAmount: number
}
