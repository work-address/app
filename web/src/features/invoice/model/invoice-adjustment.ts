/**
 * Adjustments (DEC-04): an issued invoice is never edited. What it missed -
 * hours synced late, the last afternoon before a contract ended, work after
 * a refund - is billed by a new invoice that names the one it corrects, and
 * the original stays exactly as it was.
 */

import { isFixedInvoice } from './invoice-snapshot'

/**
 * Whether `viewerId` may issue an adjustment to the invoice: its issuer
 * alone, as the API enforces - an invoice covers one person's hours, and
 * the correction is the same person's bill. Unlike marking it paid, an
 * escrow binding does not stop it: the adjustment is a separate bill, and
 * the original's allocation is left alone.
 *
 * Never on a fixed-price invoice (the API answers 409): it bills an agreed
 * sum and has no hours on it, so there are none it could have missed, and
 * another sum is the marketplace's to agree, not a button's.
 */
export const canAdjustInvoice = (
  invoice:
    | { user?: { id?: string } | null; basis?: string | null }
    | null
    | undefined,
  viewerId: string | null | undefined,
): boolean =>
  Boolean(viewerId && invoice?.user?.id === viewerId) &&
  !isFixedInvoice(invoice ?? null)

/**
 * The toast for a refused adjustment. A 400 means there was nothing left
 * to bill - every entry of the issuer's on the project is on an invoice or
 * paid - which is an answer, not a fault; anything else is a failure.
 */
export const adjustmentFailureMessageKey = (error: unknown): string =>
  (error as { response?: { status?: number } } | null)?.response?.status === 400
    ? 'invoice.adjustment.nothingToBill'
    : 'invoice.adjustment.failed'
