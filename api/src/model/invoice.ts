export enum EInvoiceState {
  PAID = 'PAID',
  REQUESTED = 'Requested',
}

/**
 * The activity behind one invoice, rolled up.
 *
 * Scoped to the entries the invoice actually bills - it is derived from those
 * rows rather than from the project, so the summary and the line items beneath
 * it cannot disagree. `rateHour` comes from the project; everything else is a
 * sum over the invoiced entries.
 *
 * Note this is *not* where the amount owed comes from: that is the invoice's
 * stored `amountCents`, frozen when it was raised. `rateTotal` is what the
 * invoiced minutes would cost at today's rate, which drifts if the project
 * rate is edited afterwards.
 */
export interface IInvoiceReport {
  rateHour: number
  rateTotal: number
  minutes: number
  minutesActive: number
  minutesPaid: number
  minutesUnpaid: number
  keyboardKeys: number
  mouseKeys: number
  mouseDistance: number
}
