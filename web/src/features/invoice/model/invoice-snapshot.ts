import { formatCents } from './format'

import type { InvoiceRead } from './types'

/** One row of the invoice's line table. */
export type InvoiceTimeRow = NonNullable<InvoiceRead['time']>[number]

type Translate = (key: string, params?: Record<string, unknown>) => string

/**
 * The hourly rate the invoice was issued at, in whole cents - read from its
 * own snapshot, never from the project, whose rate may have changed since.
 *
 * Null on a legacy invoice: one issued before invoices recorded their rate.
 * Its rate was never written down, and the project's current one is not it.
 */
export const getInvoiceRateCents = (invoice: {
  rateHourCents?: number | null
}): number | null =>
  typeof invoice.rateHourCents === 'number' ? invoice.rateHourCents : null

/** Whether the invoice bills an agreed sum rather than tracked hours. */
export const isFixedInvoice = (
  invoice: { basis?: string | null } | null,
): boolean => invoice?.basis === 'FIXED'

/**
 * The invoice page's rate field: the snapshot rate, or - on a legacy invoice
 * - a plain "not recorded" rather than a figure nobody billed at. Blank while
 * the invoice is loading, so neither flashes up before the record arrives.
 *
 * A fixed invoice has no hourly rate to show. Its stored `rateHourCents` is
 * zero, and printing "$0.00 an hour" beside an agreed sum would describe a
 * bargain nobody struck, so it says it is fixed-price instead.
 */
export const describeInvoiceRate = (
  invoice: { rateHourCents?: number | null; basis?: string | null } | null,
  t: Translate,
): { value: string; desc: string } => {
  if (!invoice) {
    return { value: '', desc: t('invoice.metricDesc.rateHour') }
  }

  if (isFixedInvoice(invoice)) {
    return {
      value: t('invoice.fields.rateFixed'),
      desc: t('invoice.metricDesc.rateFixed'),
    }
  }

  const rateCents = getInvoiceRateCents(invoice)

  if (rateCents === null) {
    return {
      value: t('invoice.fields.rateNotRecorded'),
      desc: t('invoice.metricDesc.rateNotRecorded'),
    }
  }

  return {
    value: formatCents(rateCents),
    desc: t('invoice.metricDesc.rateHour'),
  }
}

/**
 * The rows the invoice's line table prints.
 *
 * For an invoice with a snapshot, one row per billed line, in the snapshot's
 * order, with the span and active minutes it billed. The entry it came from
 * lends its note and activity counters - evidence that may since have been
 * re-synced or cleared, which is why the billed figures are not taken from
 * it. A line whose entry is no longer linked still prints what was billed.
 *
 * A legacy invoice has no lines, so its linked entries are shown as they are.
 */
export const getInvoiceTimeRows = (
  invoice: Pick<InvoiceRead, 'lines' | 'time'> | null,
): InvoiceTimeRow[] => {
  const time = invoice?.time ?? []

  if (!Array.isArray(invoice?.lines)) {
    return time
  }

  const entries = new Map(time.map((entry) => [entry.id, entry]))

  return invoice.lines.map((line) => ({
    ...entries.get(line.timeId),
    id: line.timeId,
    fromAt: line.fromAt,
    toAt: line.toAt,
    minutesActive: line.minutesActive,
  }))
}
