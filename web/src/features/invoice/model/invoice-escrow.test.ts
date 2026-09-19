import { describe, expect, it } from 'vitest'

import {
  canMarkInvoiceByHand,
  describeInvoiceEscrow,
  formatTokenAmount,
  getEscrowTxUrl,
  getInvoiceStatus,
  isEscrowBound,
} from './invoice-escrow'

import type { InvoiceEscrowFields } from './invoice-escrow'

const TX = `0x${'ab'.repeat(32)}`

/** A $30 invoice bound to an allocation on Ethereum mainnet. */
const bound: InvoiceEscrowFields & { user: { id: string }; state: string } = {
  user: { id: 'issuer' },
  state: 'Requested',
  escrowChainId: 1,
  escrowAllocationId: `0x${'11'.repeat(32)}`,
  escrowState: null,
  escrowGrossBaseUnits: null,
  escrowFeeBaseUnits: null,
  escrowNetBaseUnits: null,
  escrowRefundedBaseUnits: null,
  escrowTxHash: null,
  escrowConfirmedAt: null,
}

/** The stubbed settlement: released, 5% fee, 2 USDT of budget returned. */
const released = {
  ...bound,
  state: 'PAID',
  escrowState: 'RELEASED' as const,
  escrowGrossBaseUnits: '30000000',
  escrowFeeBaseUnits: '1500000',
  escrowNetBaseUnits: '28500000',
  escrowRefundedBaseUnits: '2000000',
  escrowTxHash: TX,
  escrowConfirmedAt: '2026-09-08T11:00:00.000Z',
}

const disputed = {
  ...bound,
  escrowState: 'DISPUTED_REFUNDED' as const,
  escrowGrossBaseUnits: '30000000',
  escrowFeeBaseUnits: '0',
  escrowNetBaseUnits: '0',
  escrowRefundedBaseUnits: '30000000',
  escrowTxHash: TX,
  escrowConfirmedAt: '2026-09-08T11:00:00.000Z',
}

describe('formatTokenAmount', () => {
  it('prints base units exactly, with at least two places', () => {
    expect(formatTokenAmount('30000000')).toBe('30.00 USDT')
    expect(formatTokenAmount('1500000')).toBe('1.50 USDT')
    expect(formatTokenAmount('0')).toBe('0.00 USDT')
  })

  it('keeps sub-cent digits instead of rounding them away', () => {
    // 5% of a 123.44 USDT bill: a fee no cent can express.
    expect(formatTokenAmount('6172000')).toBe('6.172 USDT')
    expect(formatTokenAmount('1')).toBe('0.000001 USDT')
  })

  it('stays exact beyond what a float holds', () => {
    expect(formatTokenAmount('123456789012345678901')).toBe(
      '123456789012345.678901 USDT',
    )
  })

  it('shows a dash for anything that is not base units', () => {
    expect(formatTokenAmount(null)).toBe('—')
    expect(formatTokenAmount('1.5')).toBe('—')
    expect(formatTokenAmount('-1')).toBe('—')
  })
})

describe('describeInvoiceEscrow', () => {
  it('shows gross, fee, net, refund and the transaction of a release', () => {
    expect(describeInvoiceEscrow(released)).toEqual({
      state: 'released',
      figures: [
        { id: 'gross', amount: '30.00 USDT' },
        { id: 'fee', amount: '1.50 USDT' },
        { id: 'net', amount: '28.50 USDT' },
        { id: 'refunded', amount: '2.00 USDT' },
      ],
      txHash: TX,
      txUrl: `https://etherscan.io/tx/${TX}`,
      confirmedAt: '2026-09-08T11:00:00.000Z',
    })
  })

  it('shows a dispute as the bill and its refund, with no payout', () => {
    expect(describeInvoiceEscrow(disputed)).toMatchObject({
      state: 'disputed',
      figures: [
        { id: 'gross', amount: '30.00 USDT' },
        { id: 'refunded', amount: '30.00 USDT' },
      ],
    })
  })

  it('shows an expiry as the refunded budget alone', () => {
    const expired = describeInvoiceEscrow({
      ...bound,
      escrowState: 'EXPIRED_REFUNDED',
      escrowGrossBaseUnits: '0',
      escrowFeeBaseUnits: '0',
      escrowNetBaseUnits: '0',
      escrowRefundedBaseUnits: '50000000',
      escrowTxHash: TX,
      escrowConfirmedAt: '2026-09-08T11:00:00.000Z',
    })

    expect(expired?.state).toBe('expired')
    expect(expired?.figures).toEqual([{ id: 'refunded', amount: '50.00 USDT' }])
  })

  it('is pending, with nothing to show, until the chain confirms the bill', () => {
    expect(describeInvoiceEscrow(bound)).toEqual({
      state: 'pending',
      figures: [],
      txHash: null,
      txUrl: null,
      confirmedAt: null,
    })
  })

  it('is nothing for an invoice never submitted to escrow', () => {
    expect(describeInvoiceEscrow({ escrowAllocationId: null })).toBeNull()
    expect(describeInvoiceEscrow({})).toBeNull()
    expect(describeInvoiceEscrow(null)).toBeNull()
  })
})

describe('getEscrowTxUrl', () => {
  it('links a known chain and leaves the local node unlinked', () => {
    expect(getEscrowTxUrl(137, TX)).toBe(`https://polygonscan.com/tx/${TX}`)
    expect(getEscrowTxUrl(31_337, TX)).toBeNull()
    expect(getEscrowTxUrl(1, null)).toBeNull()
  })
})

describe('canMarkInvoiceByHand', () => {
  const manual = { ...bound, escrowAllocationId: null }

  it('lets the issuer mark an invoice never submitted to escrow', () => {
    expect(canMarkInvoiceByHand(manual, 'issuer')).toBe(true)
  })

  it('gives nobody the control once the invoice is escrow-bound', () => {
    for (const invoice of [bound, released, disputed]) {
      expect(isEscrowBound(invoice)).toBe(true)
      expect(canMarkInvoiceByHand(invoice, 'issuer')).toBe(false)
    }
  })

  it('never gives it to anyone but the issuer', () => {
    expect(canMarkInvoiceByHand(manual, 'owner')).toBe(false)
    expect(canMarkInvoiceByHand(manual, null)).toBe(false)
  })
})

describe('getInvoiceStatus', () => {
  it('is paid however the invoice was paid', () => {
    expect(getInvoiceStatus(released)).toBe('paid')
    expect(getInvoiceStatus({ state: 'PAID' })).toBe('paid')
  })

  it('is refunded once the escrow gave the money back', () => {
    expect(getInvoiceStatus(disputed)).toBe('refunded')
    expect(
      getInvoiceStatus({ ...bound, escrowState: 'CANCELLED_REFUNDED' }),
    ).toBe('refunded')
  })

  it('is still owed while unpaid and not refunded', () => {
    expect(getInvoiceStatus(bound)).toBe('requested')
    expect(getInvoiceStatus({ ...bound, escrowState: 'SUBMITTED' })).toBe(
      'requested',
    )
    expect(getInvoiceStatus({ state: 'Requested' })).toBe('requested')
  })
})
