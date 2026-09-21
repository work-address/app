import { describe, expect, it } from 'vitest'

import {
  adjustmentFailureMessageKey,
  canAdjustInvoice,
} from './invoice-adjustment'

describe('canAdjustInvoice', () => {
  const invoice = { user: { id: 'issuer' } }

  it('is the issuer’s alone', () => {
    expect(canAdjustInvoice(invoice, 'issuer')).toBe(true)
    expect(canAdjustInvoice(invoice, 'owner')).toBe(false)
    expect(canAdjustInvoice(invoice, null)).toBe(false)
    expect(canAdjustInvoice({ user: null }, 'issuer')).toBe(false)
    expect(canAdjustInvoice(null, 'issuer')).toBe(false)
  })
})

describe('adjustmentFailureMessageKey', () => {
  it('reads a 400 as nothing left to bill, and anything else as a failure', () => {
    expect(adjustmentFailureMessageKey({ response: { status: 400 } })).toBe(
      'invoice.adjustment.nothingToBill',
    )
    expect(adjustmentFailureMessageKey({ response: { status: 403 } })).toBe(
      'invoice.adjustment.failed',
    )
    expect(adjustmentFailureMessageKey(new Error('offline'))).toBe(
      'invoice.adjustment.failed',
    )
    expect(adjustmentFailureMessageKey(null)).toBe('invoice.adjustment.failed')
  })
})
