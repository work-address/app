import { combine } from 'effector'

import { getInvoiceTimeRows } from './invoice-snapshot'
import { invoiceQuery } from './queries'

import type { ProjectInvoice } from './types'

export const $invoice = combine(
  invoiceQuery.$data,
  (record): ProjectInvoice | null => {
    if (!record) {
      return null
    }

    return {
      ...record,
      // The project supplies only the heading. `id` and `createdAt` stay the
      // invoice's own - spreading the project over them, as this store used
      // to, put the project's id in the QR code and the project's creation
      // date on the "issued" line.
      title: record.project?.title,
      // Read from the stored invoice, never recomputed. The old code derived
      // this from the project's *current* total active minutes, so it summed
      // every contributor's hours - including already-paid ones - and moved
      // every time anyone tracked more.
      totalAmount: Number(record.amountCents ?? 0) / 100,
    }
  },
)

/**
 * The line table: what the invoice billed, from its snapshot, with each
 * entry's note and activity alongside (see getInvoiceTimeRows).
 */
export const $invoiceTime = combine(invoiceQuery.$data, getInvoiceTimeRows)

export const $invoiceLoading = invoiceQuery.$pending
