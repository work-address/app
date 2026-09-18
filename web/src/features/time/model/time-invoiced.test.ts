import { describe, expect, it } from 'vitest'

import { hasInvoicedTime, isTimeInvoiced } from './time-invoiced'

const INVOICE_ID = '6a3f8f0e-3b1c-4c52-9a55-0f5f0c6f2b11'

describe('isTimeInvoiced', () => {
  it('is true for an entry an invoice bills', () => {
    expect(isTimeInvoiced({ invoiceId: INVOICE_ID })).toBe(true)
  })

  it('is false for an entry on no invoice', () => {
    expect(isTimeInvoiced({ invoiceId: null })).toBe(false)
    expect(isTimeInvoiced({})).toBe(false)
  })
})

describe('hasInvoicedTime', () => {
  const entries = [
    { id: 'invoiced', invoiceId: INVOICE_ID },
    { id: 'free', invoiceId: null },
    { id: 'legacy' },
  ]

  it('is true when one selected entry is invoiced', () => {
    expect(hasInvoicedTime(entries, ['free', 'invoiced'])).toBe(true)
  })

  it('is false when no selected entry is invoiced', () => {
    expect(hasInvoicedTime(entries, ['free', 'legacy'])).toBe(false)
  })

  it('ignores invoiced entries that are not selected', () => {
    expect(hasInvoicedTime(entries, ['free'])).toBe(false)
  })

  it('is false for an empty selection', () => {
    expect(hasInvoicedTime(entries, [])).toBe(false)
  })
})
