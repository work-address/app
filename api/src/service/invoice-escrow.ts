import * as crypto from 'crypto'
import * as web3 from 'web3'

import { Invoice } from '@/entity/invoice'
import {
  EInvoiceEscrowState,
  IInvoiceCommitmentBinding,
  IInvoiceEscrowSettlement,
  IInvoiceEscrowSubmission,
  IInvoiceEscrowSubmissionRequest,
} from '@/model/invoice'

/**
 * How a settlement push relates to what the invoice already records:
 * `apply` moves it forward, `recorded` is the same outcome again, `stale` is
 * older than what is recorded, and `conflict` cannot follow it on any chain.
 */
export type TSettlementProgress =
  | { outcome: 'apply' | 'recorded' | 'stale' }
  | { outcome: 'conflict'; reason: string }

/**
 * The rules tying an invoice to the MarketplaceEscrow allocation it bills,
 * kept apart from the transactions InvoiceManager runs them in.
 *
 * Money crosses here from cents to token base units, and only as integers:
 * USDT has 6 decimals, so a cent is exactly 10^4 base units, and the
 * conversion is a BigInt multiplication - never a division by 100 into a
 * float, which turns 201 cents into 2009999.9999999998.
 */
export class InvoiceEscrow {
  /** Token base units per cent: USDT's 6 decimals less the 2 of a cent. */
  public static readonly BASE_UNITS_PER_CENT = BigInt(10) ** BigInt(4)

  /** `amountCents` in token base units, as the decimal string a uint256 takes. */
  public static amountBaseUnits(amountCents: number): string {
    if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
      throw new TypeError(
        `An amount in cents is a non-negative integer, got ${amountCents}`,
      )
    }

    return (BigInt(amountCents) * InvoiceEscrow.BASE_UNITS_PER_CENT).toString()
  }

  /**
   * The allocation as it is stored and compared: the escrow and the id in
   * lowercase, as InvoiceCommitment commits them, so two casings of one
   * allocation are one allocation.
   */
  public static binding(
    binding: IInvoiceCommitmentBinding,
  ): IInvoiceCommitmentBinding {
    return {
      chainId: binding.chainId,
      escrow: binding.escrow.toLowerCase(),
      allocationId: binding.allocationId.toLowerCase(),
    }
  }

  /**
   * The tag the marketplace hashes a contract's funded work period under
   * (web/api `EscrowManager`); an obligation id is that period's identity.
   */
  public static readonly OBLIGATION_TAG = 'work-address:contract-period'

  /**
   * The obligation id of a marketplace contract's work period:
   * `keccak256(abi.encodePacked(string TAG, string contractId, uint64
   * workStart, uint64 workEnd))`, times in unix seconds - byte for byte the
   * id web/api's EscrowManager puts in the escrow terms it has signed.
   */
  public static obligationId(
    contractId: string,
    workStart: number,
    workEnd: number,
  ): string {
    return InvoiceEscrow.keccakPacked(
      { type: 'string', value: InvoiceEscrow.OBLIGATION_TAG },
      { type: 'string', value: contractId },
      { type: 'uint64', value: InvoiceEscrow.uint64(workStart) },
      { type: 'uint64', value: InvoiceEscrow.uint64(workEnd) },
    )
  }

  /**
   * The allocation id MarketplaceEscrow funds an obligation under on one
   * chain and escrow: `keccak256(abi.encodePacked(uint256 chainId, address
   * escrow, bytes32 obligationId))`, lowercase like every stored id.
   */
  public static allocationId(
    chainId: number,
    escrow: string,
    obligationId: string,
  ): string {
    return InvoiceEscrow.keccakPacked(
      { type: 'uint256', value: chainId },
      { type: 'address', value: escrow.toLowerCase() },
      { type: 'bytes32', value: obligationId },
    )
  }

  /**
   * The allocation the marketplace funds for `contractId`'s work period in
   * `request`, on the request's chain and escrow. The one allocation an
   * invoice on that contract's project may be submitted to for that period:
   * anything else funds another contract's work, or another period's.
   */
  public static contractPeriodAllocationId(
    contractId: string,
    request: IInvoiceEscrowSubmissionRequest,
  ): string {
    return InvoiceEscrow.allocationId(
      request.chainId,
      request.escrow,
      InvoiceEscrow.obligationId(
        contractId,
        request.workStart,
        request.workEnd,
      ),
    )
  }

  /**
   * Whether the invoice's period - the one its record commits to - lies
   * inside the work period, both ends included: an allocation pays for the
   * work of its own period only.
   */
  public static withinPeriod(
    invoice: Invoice,
    period: { workStart: number; workEnd: number },
  ): boolean {
    return (
      new Date(invoice.fromAt).getTime() >= period.workStart * 1000 &&
      new Date(invoice.toAt).getTime() <= period.workEnd * 1000
    )
  }

  /**
   * 32 random bytes as 0x hex, for one submission's commitment. Drawn from
   * the platform CSPRNG; an all-zero draw - which InvoiceCommitment refuses,
   * as no salt at all - is drawn again.
   */
  public static drawSalt(): string {
    for (;;) {
      const bytes = crypto.randomBytes(32)

      if (bytes.some((byte) => byte !== 0)) {
        return `0x${bytes.toString('hex')}`
      }
    }
  }

  public static isBound(invoice: Invoice): boolean {
    return Boolean(invoice.escrowAllocationId)
  }

  /** Whether `invoice` is bound to exactly this allocation. */
  public static isBoundTo(
    invoice: Invoice,
    binding: IInvoiceCommitmentBinding,
  ): boolean {
    const target = InvoiceEscrow.binding(binding)

    return (
      invoice.escrowChainId === target.chainId &&
      invoice.escrowAddress === target.escrow &&
      invoice.escrowAllocationId === target.allocationId
    )
  }

  /** The submission a bound invoice was given, rebuilt from what it stored. */
  public static submission(invoice: Invoice): IInvoiceEscrowSubmission {
    if (
      !invoice.escrowChainId ||
      !invoice.escrowAddress ||
      !invoice.escrowAllocationId ||
      !invoice.escrowCommitment ||
      !invoice.escrowSalt
    ) {
      throw new TypeError(`Invoice ${invoice.id} is not bound to an escrow`)
    }

    return {
      invoiceId: invoice.id,
      chainId: invoice.escrowChainId,
      escrow: invoice.escrowAddress,
      allocationId: invoice.escrowAllocationId,
      amountBaseUnits: InvoiceEscrow.amountBaseUnits(invoice.amountCents),
      invoiceCommitment: invoice.escrowCommitment,
      salt: invoice.escrowSalt,
    }
  }

  /** Every state but SUBMITTED is final: the allocation settles once. */
  public static isFinal(state: EInvoiceEscrowState): boolean {
    return state !== EInvoiceEscrowState.SUBMITTED
  }

  /**
   * Why a pushed settlement cannot be what MarketplaceEscrow reports, or null
   * when it can. The contract's own arithmetic, checked here so a malformed
   * push is refused before it touches an invoice:
   *  - a bill was submitted (gross > 0, with its commitment) unless the
   *    allocation expired or was cancelled first, when there is neither
   *  - release pays gross exactly, as net plus fee; nothing else pays out
   *  - a dispute refunds at least the bill
   *  - a settled allocation names its transaction and block time, and one
   *    still awaiting release names neither
   */
  public static settlementProblem(
    settlement: IInvoiceEscrowSettlement,
  ): string | null {
    const gross = BigInt(settlement.grossBaseUnits)
    const fee = BigInt(settlement.feeBaseUnits)
    const net = BigInt(settlement.netBaseUnits)
    const refunded = BigInt(settlement.refundedBaseUnits)
    const state = settlement.escrowState
    const zero = BigInt(0)
    const unbilled =
      state === EInvoiceEscrowState.EXPIRED_REFUNDED ||
      state === EInvoiceEscrowState.CANCELLED_REFUNDED

    if (unbilled) {
      if (gross !== zero || settlement.invoiceCommitment !== null) {
        return `An allocation ${state} before any bill carries no gross amount or commitment`
      }
    } else if (gross === zero || settlement.invoiceCommitment === null) {
      return `A ${state} allocation carries the bill it was submitted: a gross amount and a commitment`
    }

    if (state === EInvoiceEscrowState.RELEASED) {
      if (fee + net !== gross) {
        return 'A release pays the gross amount exactly, as net plus fee'
      }
    } else if (fee !== zero || net !== zero) {
      return `A ${state} allocation paid out nothing, so it has no fee or net`
    }

    if (state === EInvoiceEscrowState.DISPUTED_REFUNDED && refunded < gross) {
      return 'A dispute refunds at least the bill'
    }

    const settled = InvoiceEscrow.isFinal(state)

    if (settled !== (settlement.txHash !== null)) {
      return settled
        ? `A ${state} allocation names the transaction that settled it`
        : 'An allocation awaiting release has no settling transaction yet'
    }

    if (settled !== (settlement.confirmedAt !== null)) {
      return settled
        ? `A ${state} allocation names the time its settlement was confirmed`
        : 'An allocation awaiting release has no settlement time yet'
    }

    return null
  }

  /**
   * Whether a push moves the invoice's recorded outcome forward.
   *
   * The push carries the allocation's absolute state, so the same push twice
   * is `recorded`, and a push overtaken by a later one - a retry arriving
   * after the push that followed it - is `stale`: SUBMITTED comes before any
   * final state, and within one state the payer's refunds only grow. What
   * cannot happen on one allocation is a `conflict`: two different final
   * states, a different bill, or a different settling transaction or payout
   * for the same state.
   */
  public static progress(
    invoice: Invoice,
    settlement: IInvoiceEscrowSettlement,
  ): TSettlementProgress {
    const recorded = invoice.escrowState

    if (!recorded) {
      return { outcome: 'apply' }
    }

    const incoming = settlement.escrowState
    const conflict = (reason: string): TSettlementProgress => ({
      outcome: 'conflict',
      reason: `Invoice ${invoice.id} records ${recorded}: ${reason}`,
    })

    if (
      InvoiceEscrow.isFinal(recorded) &&
      InvoiceEscrow.isFinal(incoming) &&
      recorded !== incoming
    ) {
      return conflict(`the allocation cannot also be ${incoming}`)
    }

    if (
      !InvoiceEscrow.same(
        invoice.escrowGrossBaseUnits,
        settlement.grossBaseUnits,
      )
    ) {
      return conflict(
        `the bill was ${invoice.escrowGrossBaseUnits} base units, not ${settlement.grossBaseUnits}`,
      )
    }

    if (recorded !== incoming) {
      return InvoiceEscrow.isFinal(incoming)
        ? { outcome: 'apply' }
        : { outcome: 'stale' }
    }

    if (
      !InvoiceEscrow.same(
        invoice.escrowFeeBaseUnits,
        settlement.feeBaseUnits,
      ) ||
      !InvoiceEscrow.same(
        invoice.escrowNetBaseUnits,
        settlement.netBaseUnits,
      ) ||
      (invoice.escrowTxHash ?? null) !==
        (settlement.txHash?.toLowerCase() ?? null) ||
      (invoice.escrowConfirmedAt
        ? new Date(invoice.escrowConfirmedAt).getTime()
        : null) !==
        (settlement.confirmedAt === null ? null : settlement.confirmedAt * 1000)
    ) {
      return conflict('the same state was settled differently')
    }

    const refunded = BigInt(invoice.escrowRefundedBaseUnits ?? '0')
    const pushed = BigInt(settlement.refundedBaseUnits)

    if (pushed === refunded) {
      return { outcome: 'recorded' }
    }

    return pushed > refunded ? { outcome: 'apply' } : { outcome: 'stale' }
  }

  /** A time in unix seconds as a uint64 takes it: a whole, non-negative number. */
  private static uint64(seconds: number): number {
    if (!Number.isSafeInteger(seconds) || seconds < 0) {
      throw new TypeError(
        `A time in unix seconds is a non-negative integer, got ${seconds}`,
      )
    }

    return seconds
  }

  private static keccakPacked(
    ...values: { type: string; value: string | number }[]
  ): string {
    const hash = web3.utils.soliditySha3(...values)

    if (!hash) {
      throw new TypeError('Nothing to hash')
    }

    return hash.toLowerCase()
  }

  /** Two base-unit amounts, as stored and as pushed, are the same number. */
  private static same(
    stored: string | null | undefined,
    pushed: string,
  ): boolean {
    return stored !== null && stored !== undefined
      ? BigInt(stored) === BigInt(pushed)
      : false
  }
}
