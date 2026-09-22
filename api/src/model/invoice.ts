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
 * `MILESTONE` is the marketplace's signed internal call billing an agreed
 * milestone: neither a person here nor this project's cadence raised it, and
 * it carries a `milestoneRef` rather than a cadence period.
 *
 * Null on invoices issued before this was recorded; they were all manual.
 */
export enum EInvoiceIssuanceKind {
  MANUAL = 'MANUAL',
  SCHEDULED = 'SCHEDULED',
  MILESTONE = 'MILESTONE',
}

/**
 * What an invoice charges for.
 *
 * `HOURLY` is the original and only basis until now: tracked entries at the
 * project's rate, and the amount is their active minutes priced by it. Every
 * invoice issued before this column existed is hourly, which is why the
 * column defaults to it.
 *
 * `FIXED` bills an agreed sum for a named piece of work - a marketplace
 * milestone - and has no tracked entries behind it at all. The alternative
 * was to fabricate Time rows adding up to the sum, which would have put
 * hours nobody worked into the work record and made `Time` lie to keep
 * `Invoice` simple. A fixed invoice therefore carries no rate and no lines,
 * and says in `description` what it is billing for; nothing may read an
 * hourly rate off it.
 */
export enum EInvoiceBasis {
  HOURLY = 'HOURLY',
  FIXED = 'FIXED',
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
 * A FIXED invoice has no rate either, and no minutes: it bills an agreed sum
 * for a named piece of work, so every counter here is zero and `rateHour` and
 * `rateTotal` are null. Reading a rate off it - `amountCents` divided by the
 * minutes it does not have - would be a figure nobody agreed to, and on zero
 * minutes not a figure at all.
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
 * An agreed milestone the marketplace is billing, as its signed internal call
 * pushes it.
 *
 * `milestoneRef` is the marketplace's own id for the piece of work and the
 * idempotency key: the same reference pushed again answers with the invoice
 * the first push raised. `amountCents` is the sum both sides agreed, in whole
 * cents, and `description` is what it is for - a fixed invoice has no lines,
 * so without it the bill would be a number with nothing behind it.
 * `workStart`/`workEnd` are the milestone's period in unix seconds; they
 * become the invoice's own period, which is what an escrow allocation for
 * that period is checked against.
 */
export interface IInvoiceMilestoneBill {
  milestoneRef: string
  amountCents: number
  description: string
  workStart: number
  workEnd: number
  /*
   * The escrow allocation whose release paid it, and the bytes32 its bill
   * committed to: all four null when escrow did not pay it.
   */
  chainId: number | null
  escrow: string | null
  allocationId: string | null
  invoiceCommitment: string | null
}

/** What billing a milestone did: the invoice, and whether this call raised it. */
export interface IInvoiceMilestoneResult {
  invoiceId: string
  created: boolean
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
  /**
   * Present only on a FIXED invoice, with the two fields that say what it
   * bills: an hourly record never carries them, so its bytes are unchanged.
   */
  basis?: EInvoiceBasis.FIXED
  milestoneRef?: string
  description?: string
  /**
   * Present only on an adjustment: the invoice it corrects, so the bill the
   * commitment binds says what it is a correction of.
   */
  correctsInvoiceId?: string
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
  /**
   * False when the push was one already recorded, or older than it, or the
   * unbilled end of an allocation the invoice is no longer bound to.
   */
  applied: boolean
  invoiceId: string
  state: EInvoiceState
  /** What the invoice records of its own allocation; null when nothing. */
  escrowState: EInvoiceEscrowState | null
}

/**
 * A settlement the marketplace pushed and the app acknowledged, which the
 * chain no longer holds: a reorganisation took back the block it was
 * confirmed in. It names that settlement exactly as it was pushed - its
 * state, the bill, the payout, the refunds and the settling transaction
 * (null for a remainder refunded beside a bill still awaiting release) - so
 * the app undoes only what it recorded from it.
 */
export interface IInvoiceEscrowReversal extends IInvoiceCommitmentBinding {
  invoiceId: string
  escrowState: EInvoiceEscrowState
  grossBaseUnits: string
  feeBaseUnits: string
  netBaseUnits: string
  refundedBaseUnits: string
  txHash: string | null
}

/**
 * The invoice bound to an allocation, as the marketplace asks for it
 * (POST /api/internal/marketplace/escrow-binding): null when none is.
 */
export interface IInvoiceEscrowBindingResult {
  invoiceId: string | null
}

/** What recording a settlement reversal did. */
export interface IInvoiceEscrowReversalResult {
  /**
   * False when the invoice records nothing of that settlement: reversed
   * already, overtaken by the settlement that replaced it, or never there.
   */
  applied: boolean
  invoiceId: string
  state: EInvoiceState
  /** What the invoice records of its allocation now; null once nothing. */
  escrowState: EInvoiceEscrowState | null
}
