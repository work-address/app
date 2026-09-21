export enum EInvoiceState {
  PAID = 'PAID',
  REQUESTED = 'Requested',
}

/**
 * How a paid (or refunded) invoice was settled: marked by its issuer, or
 * reported from a confirmed MarketplaceEscrow outcome.
 */
export enum EInvoiceSettlementKind {
  MANUAL = 'MANUAL',
  ESCROW = 'ESCROW',
}

/**
 * Where the escrow allocation an invoice is bound to stands, as its confirmed
 * events leave it - MarketplaceEscrow's own states, named as the marketplace
 * projection names them. SUBMITTED awaits release or dispute; every other
 * value is final. RELEASED paid the bill; DISPUTED_REFUNDED returned it to
 * the payer; EXPIRED_REFUNDED and CANCELLED_REFUNDED returned the budget
 * before any bill was submitted.
 */
export enum EInvoiceEscrowState {
  SUBMITTED = 'SUBMITTED',
  RELEASED = 'RELEASED',
  DISPUTED_REFUNDED = 'DISPUTED_REFUNDED',
  EXPIRED_REFUNDED = 'EXPIRED_REFUNDED',
  CANCELLED_REFUNDED = 'CANCELLED_REFUNDED',
}

/**
 * How an invoice came to exist.
 *
 * `MANUAL` is somebody pressing the button - the route in InvoiceController,
 * which stays exactly as it was. `SCHEDULED` is the project's own cadence
 * issuing it, and only a scheduled invoice carries the period it bills, which
 * is what makes "one invoice per project, issuer and period" enforceable in
 * the database (see `Invoice`'s unique key).
 *
 * Null on invoices issued before this was recorded; they were all manual.
 */
export enum EInvoiceIssuanceKind {
  MANUAL = 'MANUAL',
  SCHEDULED = 'SCHEDULED',
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

/**
 * Where an invoice commitment is submitted: the escrow allocation it bills.
 *
 * Committed alongside the record, so an opening proves which chain, which
 * escrow deployment and which allocation the invoice was submitted to - the
 * same invoice and salt submitted anywhere else is a different commitment.
 * `escrow` is an EVM address and `allocationId` a 0x-prefixed bytes32, both in
 * any casing; the commitment lowercases them.
 */
export interface IInvoiceCommitmentBinding {
  chainId: number
  escrow: string
  allocationId: string
}

/**
 * A request to submit an invoice to an allocation: the allocation, and the
 * work period the marketplace funded it for, in unix seconds (the uint64s
 * MarketplaceEscrow's terms carry).
 *
 * The marketplace derives every allocation id from its contract and period,
 * so with the contract the invoice's project was hired under, the period is
 * what lets this service recompute the id and refuse one that funds some
 * other contract's work.
 */
export interface IInvoiceEscrowSubmissionRequest
  extends IInvoiceCommitmentBinding {
  workStart: number
  workEnd: number
}

/**
 * What the issuer submits to MarketplaceEscrow for one invoice: the amount in
 * token base units and the commitment, with the allocation both are bound to
 * and the salt the commitment was drawn under.
 *
 * `amountBaseUnits` is the invoice's `amountCents` in USDT base units (6
 * decimals, so a cent is 10^4 of them), as a decimal string: the chain takes
 * a uint256, and no float ever touches it. `salt` is here because this
 * response only ever goes to the issuer - it is the export that lets them
 * open the commitment without this service.
 */
export interface IInvoiceEscrowSubmission extends IInvoiceCommitmentBinding {
  invoiceId: string
  amountBaseUnits: string
  invoiceCommitment: string
  salt: string
}

/**
 * A confirmed escrow outcome for the allocation an invoice is bound to, as
 * the marketplace pushes it: the allocation's state and totals after the
 * event, not the event's own delta, so re-applying it changes nothing.
 *
 * Amounts are token base units as decimal strings. `gross` is what the bill
 * put on chain, `fee` and `net` what release paid the fee recipient and the
 * payee (0 until released), `refunded` everything returned to the payer from
 * the allocation so far. `txHash` is the transaction that settled it -
 * release, dispute, expiry or cancellation - and `confirmedAt` that block's
 * time in unix seconds; both null while SUBMITTED.
 */
export interface IInvoiceEscrowSettlement extends IInvoiceCommitmentBinding {
  invoiceId: string
  invoiceCommitment: string | null
  escrowState: EInvoiceEscrowState
  grossBaseUnits: string
  feeBaseUnits: string
  netBaseUnits: string
  refundedBaseUnits: string
  txHash: string | null
  confirmedAt: number | null
}

/** What recording a settlement push did. */
export interface IInvoiceEscrowSettlementResult {
  /** False when the push was one already recorded, or older than it. */
  applied: boolean
  invoiceId: string
  state: EInvoiceState
  escrowState: EInvoiceEscrowState
}
