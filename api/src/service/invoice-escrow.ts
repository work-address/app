import * as crypto from 'crypto'

import { Invoice } from '@/entity/invoice'
import {
  IInvoiceCommitmentBinding,
  IInvoiceEscrowSubmission,
} from '@/model/invoice'

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
}
