import type { baseApi } from '@/shared'

/**
 * The invoice read endpoint's response: the record with its financial
 * snapshot (rate, minutes and billed lines, frozen at issuance), the entries
 * it bills, and their roll-up.
 */
export type InvoiceRead = baseApi.InvoiceControllerReadResponses[200]

/**
 * The invoice's roll-up. Rate, minutes and paid/unpaid come from its
 * snapshot; the activity counters from the entries it bills. `rateHour` is
 * null on a legacy invoice, which never recorded one.
 */
export type InvoiceReport = NonNullable<InvoiceRead['report']>

/** One billed entry as the invoice froze it at issuance. */
export type InvoiceLine = NonNullable<InvoiceRead['lines']>[number]

export type ProjectInvoice = InvoiceRead & {
  /** The project's name, shown as the invoice heading. */
  title?: string
  /** `amountCents` in currency units. Never recomputed from time. */
  totalAmount: number
}
