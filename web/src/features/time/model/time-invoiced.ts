import type { Time } from '@/entities/time'

/**
 * Whether an invoice bills this entry. Its paid state then belongs to that
 * invoice: the API refuses to change it directly (409), so the table, the
 * dialog and the bulk actions offer no control for it.
 */
export const isTimeInvoiced = (entry: Pick<Time, 'invoiceId'>): boolean =>
  Boolean(entry.invoiceId)

/**
 * Whether any selected entry is on an invoice. The API refuses a bulk
 * paid/unpaid request whole if one is, so the actions are disabled rather
 * than offered and refused.
 */
export const hasInvoicedTime = (
  entries: Pick<Time, 'id' | 'invoiceId'>[],
  selectedIds: string[],
): boolean => {
  const selected = new Set(selectedIds)

  return entries.some(
    (entry) =>
      entry.id !== undefined && selected.has(entry.id) && isTimeInvoiced(entry),
  )
}
