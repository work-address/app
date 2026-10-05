import { combine } from 'effector'

import { invoiceQuery } from './queries'

import type { InvoiceRead, ProjectInvoice } from './types'

import { getLoadFailureKind, type LoadFailureKind } from '@/shared'

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

export const $invoiceTime = combine(
  invoiceQuery.$data,
  (record): NonNullable<InvoiceRead['time']> => record?.time ?? [],
)

export const $invoiceLoading = invoiceQuery.$pending

/**
 * Why the invoice did not load, or null while it is loading or loaded. A
 * missing invoice gets a "not found" page with a way back to the list; any
 * other failure gets a retry. Neither may render the invoice layout, which
 * would show a payable $0.00 invoice with a QR code and "Save PDF".
 */
export const $invoiceFailure = combine(
  invoiceQuery.$failed,
  invoiceQuery.$error,
  (failed, error): LoadFailureKind | null =>
    failed ? getLoadFailureKind(error) : null,
)
