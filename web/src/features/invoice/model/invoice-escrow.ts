import type { baseApi } from '@/shared'

/**
 * An invoice's escrow binding and the outcome the marketplace reported for
 * it, as the read and list endpoints return them. Unset columns arrive as
 * null, which the generated type does not say.
 */
export type InvoiceEscrowFields = {
  [Key in
    | 'escrowChainId'
    | 'escrowAllocationId'
    | 'escrowState'
    | 'escrowGrossBaseUnits'
    | 'escrowFeeBaseUnits'
    | 'escrowNetBaseUnits'
    | 'escrowRefundedBaseUnits'
    | 'escrowTxHash'
    | 'escrowConfirmedAt']?: baseApi.InvoiceSearch[Key] | null
}

/**
 * Where the escrow stands, for display: `pending` until the chain confirms
 * the bill, then MarketplaceEscrow's own state. Only `released` pays; the
 * last three returned the money to the payer.
 */
export type InvoiceEscrowState =
  | 'pending'
  | 'submitted'
  | 'released'
  | 'disputed'
  | 'expired'
  | 'cancelled'

/** The escrow's figures, in the order the page lists them. */
export type InvoiceEscrowFigureId = 'gross' | 'fee' | 'net' | 'refunded'

export type InvoiceEscrowFigure = {
  id: InvoiceEscrowFigureId
  /** Exact token amount with its symbol, e.g. `28.50 USDT`. */
  amount: string
}

export type InvoiceEscrowView = {
  state: InvoiceEscrowState
  figures: InvoiceEscrowFigure[]
  txHash: string | null
  /** A block explorer page for the transaction, when the chain has one. */
  txUrl: string | null
  /** ISO time of the block that settled it. */
  confirmedAt: string | null
}

/**
 * Where the settlement is drawn: a section of the invoice page, or one dense
 * line under an invoice in the list.
 */
export type InvoiceEscrowLayout = 'page' | 'row'

/** The badge an invoice wears: paid, still owed, or given back by escrow. */
export type InvoiceStatus = 'paid' | 'requested' | 'refunded'

/** USDT, which MarketplaceEscrow counts in base units of 6 decimals. */
export const ESCROW_TOKEN = { symbol: 'USDT', decimals: 6 } as const

const STATES: Record<
  NonNullable<baseApi.InvoiceSearch['escrowState']>,
  InvoiceEscrowState
> = {
  SUBMITTED: 'submitted',
  RELEASED: 'released',
  DISPUTED_REFUNDED: 'disputed',
  EXPIRED_REFUNDED: 'expired',
  CANCELLED_REFUNDED: 'cancelled',
}

const REFUNDED_STATES: ReadonlySet<InvoiceEscrowState> = new Set([
  'disputed',
  'expired',
  'cancelled',
])

/**
 * Explorers by EIP-155 chain id. A chain missing here - the local Hardhat
 * node among them - shows the hash without a link.
 */
const EXPLORER_TX_BASE: Record<number, string> = {
  1: 'https://etherscan.io/tx/',
  10: 'https://optimistic.etherscan.io/tx/',
  56: 'https://bscscan.com/tx/',
  137: 'https://polygonscan.com/tx/',
  8453: 'https://basescan.org/tx/',
  42_161: 'https://arbiscan.io/tx/',
  11_155_111: 'https://sepolia.etherscan.io/tx/',
}

const BASE_UNITS = /^\d+$/

/** Whether the invoice was submitted to an escrow allocation. */
export const isEscrowBound = (
  invoice: Pick<InvoiceEscrowFields, 'escrowAllocationId'> | null | undefined,
): boolean => Boolean(invoice?.escrowAllocationId)

/**
 * Whether `userId` may mark the invoice paid or unpaid: only its issuer, and
 * never once it is submitted to escrow - the chain's outcome settles it then,
 * and the API refuses a hand mark with a 409.
 */
export const canMarkInvoiceByHand = (
  invoice:
    | (Pick<InvoiceEscrowFields, 'escrowAllocationId'> & {
        user?: { id?: string } | null
      })
    | null
    | undefined,
  userId: string | null | undefined,
): boolean =>
  Boolean(userId && invoice?.user?.id === userId && !isEscrowBound(invoice))

/**
 * Token base units as an exact decimal with the token symbol: at least two
 * places, more only when the amount has them (`6.172 USDT`, never rounded to
 * a cent it is not). BigInt throughout - base units exceed what a float holds
 * exactly. Anything that is not a base-unit integer shows as a dash.
 */
export const formatTokenAmount = (
  baseUnits: string | null | undefined,
): string => {
  if (!baseUnits || !BASE_UNITS.test(baseUnits)) {
    return '—'
  }

  const value = BigInt(baseUnits)
  const unit = 10n ** BigInt(ESCROW_TOKEN.decimals)
  const fraction = (value % unit)
    .toString()
    .padStart(ESCROW_TOKEN.decimals, '0')
    .replace(/0+$/, '')
    .padEnd(2, '0')

  return `${value / unit}.${fraction} ${ESCROW_TOKEN.symbol}`
}

/** The explorer page for `txHash` on `chainId`, or null when none is known. */
export const getEscrowTxUrl = (
  chainId: number | null | undefined,
  txHash: string | null | undefined,
): string | null => {
  const base = chainId ? EXPLORER_TX_BASE[chainId] : undefined

  return base && txHash ? `${base}${txHash}` : null
}

const isPositive = (baseUnits: string | null | undefined): boolean =>
  Boolean(baseUnits && BASE_UNITS.test(baseUnits) && BigInt(baseUnits) > 0n)

/**
 * What the invoice page and list show of an escrow settlement, or null for an
 * invoice never submitted to escrow.
 *
 * The figures are the ones that happened: the bill once it is on chain, the
 * 5% fee and the 95% the issuer received only on a release, and whatever was
 * refunded to the payer - the bill after a dispute, the budget after an
 * expiry or cancellation, the unbilled remainder beside a release.
 */
export const describeInvoiceEscrow = (
  invoice: InvoiceEscrowFields | null | undefined,
): InvoiceEscrowView | null => {
  if (!invoice || !isEscrowBound(invoice)) {
    return null
  }

  const state = invoice.escrowState ? STATES[invoice.escrowState] : 'pending'
  const figures: InvoiceEscrowFigure[] = []
  const add = (id: InvoiceEscrowFigureId, baseUnits?: string | null) =>
    figures.push({ id, amount: formatTokenAmount(baseUnits) })

  if (isPositive(invoice.escrowGrossBaseUnits)) {
    add('gross', invoice.escrowGrossBaseUnits)
  }

  if (state === 'released') {
    add('fee', invoice.escrowFeeBaseUnits)
    add('net', invoice.escrowNetBaseUnits)
  }

  if (isPositive(invoice.escrowRefundedBaseUnits)) {
    add('refunded', invoice.escrowRefundedBaseUnits)
  }

  const txHash = invoice.escrowTxHash ?? null

  return {
    state,
    figures,
    txHash,
    txUrl: getEscrowTxUrl(invoice.escrowChainId, txHash),
    confirmedAt: invoice.escrowConfirmedAt ?? null,
  }
}

/**
 * The invoice's badge. PAID is paid however it got there. An invoice whose
 * escrow gave the money back is not awaiting payment any more - the payer
 * disputed it, or the bill never reached the chain - so it says refunded.
 */
export const getInvoiceStatus = (
  invoice:
    | (Pick<InvoiceEscrowFields, 'escrowState'> & { state?: string })
    | null
    | undefined,
): InvoiceStatus => {
  if (invoice?.state === 'PAID') {
    return 'paid'
  }

  const escrow = invoice?.escrowState ? STATES[invoice.escrowState] : null

  return escrow && REFUNDED_STATES.has(escrow) ? 'refunded' : 'requested'
}
