import type { InvoiceEscrowFields } from '../model'

const TX = '0x563ce726fe6c175a76c81392b24667cd747b87544b74f0e51bc0cbc15fcc02aa'

/** Bound to an allocation on Ethereum, before the chain confirmed the bill. */
const BOUND: InvoiceEscrowFields = {
  escrowChainId: 1,
  escrowAllocationId:
    '0x7d2a37f82ee0232848aace4b0c421193fa05c3f906d79e01f0ccf4dfd1769d1e',
  escrowState: null,
  escrowGrossBaseUnits: null,
  escrowFeeBaseUnits: null,
  escrowNetBaseUnits: null,
  escrowRefundedBaseUnits: null,
  escrowTxHash: null,
  escrowConfirmedAt: null,
}

/** The escrow outcomes an invoice can record, for stories and tests. */
export const invoiceEscrowStubs = {
  pending: BOUND,
  submitted: {
    ...BOUND,
    escrowState: 'SUBMITTED',
    escrowGrossBaseUnits: '30000000',
    escrowFeeBaseUnits: '0',
    escrowNetBaseUnits: '0',
    escrowRefundedBaseUnits: '0',
  },
  /** A 30 USDT bill released 95/5, with 2 USDT of budget returned. */
  released: {
    ...BOUND,
    escrowState: 'RELEASED',
    escrowGrossBaseUnits: '30000000',
    escrowFeeBaseUnits: '1500000',
    escrowNetBaseUnits: '28500000',
    escrowRefundedBaseUnits: '2000000',
    escrowTxHash: TX,
    escrowConfirmedAt: '2026-09-08T11:00:00.000Z',
  },
  /** Disputed on the local node, which has no explorer to link. */
  disputed: {
    ...BOUND,
    escrowChainId: 31_337,
    escrowState: 'DISPUTED_REFUNDED',
    escrowGrossBaseUnits: '123440000',
    escrowFeeBaseUnits: '0',
    escrowNetBaseUnits: '0',
    escrowRefundedBaseUnits: '123440000',
    escrowTxHash: TX,
    escrowConfirmedAt: '2026-09-10T15:30:00.000Z',
  },
  expired: {
    ...BOUND,
    escrowState: 'EXPIRED_REFUNDED',
    escrowGrossBaseUnits: '0',
    escrowFeeBaseUnits: '0',
    escrowNetBaseUnits: '0',
    escrowRefundedBaseUnits: '50000000',
    escrowTxHash: TX,
    escrowConfirmedAt: '2026-09-12T09:00:00.000Z',
  },
  cancelled: {
    ...BOUND,
    escrowState: 'CANCELLED_REFUNDED',
    escrowGrossBaseUnits: '0',
    escrowFeeBaseUnits: '0',
    escrowNetBaseUnits: '0',
    escrowRefundedBaseUnits: '50000000',
    escrowTxHash: TX,
    escrowConfirmedAt: '2026-08-30T09:00:00.000Z',
  },
} satisfies Record<string, InvoiceEscrowFields>
