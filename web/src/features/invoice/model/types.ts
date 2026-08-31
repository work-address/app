import type { baseApi } from '@/shared'

/** The invoice read endpoint's response: the record, its time, its roll-up. */
export type InvoiceRead = baseApi.InvoiceControllerReadResponses[200]

/** The activity behind the invoice, scoped to the entries it bills. */
export type InvoiceReport = NonNullable<InvoiceRead['report']>

export type ProjectInvoice = InvoiceRead & {
  /** The project's name, shown as the invoice heading. */
  title?: string
  /** `amountCents` in currency units. Never recomputed from time. */
  totalAmount: number
}
