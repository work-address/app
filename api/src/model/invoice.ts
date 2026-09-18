export enum EInvoiceState {
  PAID = 'PAID',
  REQUESTED = 'Requested',
}

/** The only currency an invoice is issued in, named so the record says so. */
export enum EInvoiceCurrency {
  USD = 'USD',
}

/**
 * Which financial snapshot an invoice carries.
 *
 * `LEGACY` is an invoice issued before invoices kept their own breakdown. It
 * has its frozen `amountCents` and nothing else: the rate it was raised at was
 * never recorded, and reading today's project rate in its place would print a
 * figure nobody agreed to. The backfill script marks these; a row still null
 * has not been backfilled yet and is read the same way.
 */
export enum EInvoiceSnapshotVersion {
  LEGACY = 0,
  V1 = 1,
}

/**
 * One billed entry, as it stood when the invoice was issued.
 *
 * The time row it came from is evidence and can change afterwards - a tracker
 * re-sync rewrites its activity, and its screenshot and processes can be
 * cleared - so the invoice keeps the part it billed on: the span and the
 * active minutes. Timestamps are ISO-8601 UTC with milliseconds.
 */
export interface IInvoiceLine {
  timeId: string
  fromAt: string
  toAt: string
  minutesActive: number
}

/**
 * The activity behind one invoice, rolled up for display.
 *
 * For an invoice with a snapshot, the money side - `rateHour`, `minutes`,
 * `minutesActive`, paid and unpaid - is read from what the invoice froze at
 * issuance, so editing the project rate or re-syncing an entry afterwards
 * changes none of it. The activity counters (keys, mouse) are read from the
 * billed entries themselves: they are monitoring evidence, not billing, and
 * may be cleared.
 *
 * A legacy invoice has no recorded rate, so `rateHour` and `rateTotal` are
 * null rather than today's project rate; its minutes come from the entries it
 * links, as they always did.
 *
 * Never the amount owed: that is the invoice's stored `amountCents`.
 */
export interface IInvoiceReport {
  rateHour: number | null
  rateTotal: number | null
  minutes: number
  minutesActive: number
  minutesPaid: number
  minutesUnpaid: number
  keyboardKeys: number
  mouseKeys: number
  mouseDistance: number
}

/**
 * InvoiceRecord v1: the canonical document an issued invoice serialises to.
 *
 * Every field is read from the invoice's own snapshot columns, never from the
 * live project or user, so the same invoice always produces the same bytes.
 * Money is integer cents, time integer minutes, and addresses are in their
 * canonical form (EVM and TON lowercase, Solana as typed).
 */
export interface IInvoiceRecord {
  version: number
  invoiceId: string
  projectId: string
  issuerId: string
  issuerAddress: string
  ownerAddress: string
  currency: string
  rateHourCents: number
  minutesActive: number
  amountCents: number
  periodStart: string
  periodEnd: string
  lines: IInvoiceLine[]
}
