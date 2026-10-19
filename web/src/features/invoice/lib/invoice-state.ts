/**
 * One place for what an invoice's state means on screen and who may act on it,
 * so the page, the two badge layouts and the list cannot drift apart.
 */
export type InvoiceStateLike = { state?: string | null } | null | undefined

export const invoiceStateLabelKey = (invoice: InvoiceStateLike): string =>
  invoice?.state === 'PAID'
    ? 'invoice.state.paid'
    : invoice?.state === 'REJECTED'
      ? 'invoice.state.rejected'
      : 'invoice.state.requested'

/** Paid is settled, rejected is closed, anything else is still owed. */
export const invoiceStateColor = (
  invoice: InvoiceStateLike,
): 'green' | 'red' | 'amber' =>
  invoice?.state === 'PAID'
    ? 'green'
    : invoice?.state === 'REJECTED'
      ? 'red'
      : 'amber'

type SettleableInvoice = {
  state?: string | null
  user?: { id?: string | null } | null
}
type Viewer = { id?: string | null } | null | undefined

/**
 * Only the issuer may settle: the person owed the money is the one who knows
 * whether it arrived. A rejected invoice is closed, so nobody settles it.
 */
export const canSettleInvoice = (
  invoice: SettleableInvoice | null | undefined,
  user: Viewer,
): boolean =>
  Boolean(
    user?.id && invoice?.user?.id === user.id && invoice.state !== 'REJECTED',
  )

type RatedInvoice = {
  lines?: Array<{ rateHourCents?: number | null }> | null
  project?: { rateHour?: number | string | null } | null
}

/**
 * The hourly rate worth printing under an invoice's amount, in currency
 * units: the one line's frozen rate, or the project's rate for an invoice
 * issued before lines were stored. Several lines have no single rate.
 */
export const invoiceRateHour = (
  invoice: RatedInvoice | null | undefined,
): number | null => {
  const lines = invoice?.lines ?? []
  if (lines.length === 1) {
    const cents = lines[0].rateHourCents
    return cents == null ? null : cents / 100
  }
  if (lines.length === 0 && invoice?.project?.rateHour != null) {
    const rate = Number(invoice.project.rateHour)
    return Number.isFinite(rate) ? rate : null
  }
  return null
}
