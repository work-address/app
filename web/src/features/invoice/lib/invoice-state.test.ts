import { describe, expect, it } from 'vitest'

import {
  canSettleInvoice,
  invoiceRateHour,
  invoiceStateColor,
  invoiceStateLabelKey,
} from './invoice-state'

describe('invoice state helpers', () => {
  it('labels and colours each state, rejected apart from awaiting', () => {
    expect(invoiceStateLabelKey({ state: 'PAID' })).toBe('invoice.state.paid')
    expect(invoiceStateLabelKey({ state: 'REJECTED' })).toBe(
      'invoice.state.rejected',
    )
    expect(invoiceStateLabelKey({ state: 'Requested' })).toBe(
      'invoice.state.requested',
    )
    expect(invoiceStateLabelKey(null)).toBe('invoice.state.requested')
    expect(invoiceStateColor({ state: 'PAID' })).toBe('green')
    expect(invoiceStateColor({ state: 'REJECTED' })).toBe('red')
    expect(invoiceStateColor({ state: 'Requested' })).toBe('amber')
  })
  it('lets only the issuer settle, and never a rejected invoice', () => {
    const invoice = { state: 'Requested', user: { id: 'worker' } }
    expect(canSettleInvoice(invoice, { id: 'worker' })).toBe(true)
    expect(canSettleInvoice(invoice, { id: 'owner' })).toBe(false)
    expect(canSettleInvoice(invoice, null)).toBe(false)
    expect(
      canSettleInvoice({ ...invoice, state: 'REJECTED' }, { id: 'worker' }),
    ).toBe(false)
    expect(
      canSettleInvoice({ ...invoice, state: 'PAID' }, { id: 'worker' }),
    ).toBe(true)
  })
  it('prints one line rate, the project rate for legacy invoices, else none', () => {
    expect(invoiceRateHour({ lines: [{ rateHourCents: 1250 }] })).toBe(12.5)
    expect(invoiceRateHour({ lines: [{ rateHourCents: null }] })).toBe(null)
    expect(
      invoiceRateHour({ lines: null, project: { rateHour: '7.50' } }),
    ).toBe(7.5)
    expect(invoiceRateHour({ lines: [], project: { rateHour: 9 } })).toBe(9)
    expect(invoiceRateHour({ lines: null, project: { rateHour: null } })).toBe(
      null,
    )
    expect(
      invoiceRateHour({
        lines: [{ rateHourCents: 100 }, { rateHourCents: 200 }],
        project: { rateHour: 9 },
      }),
    ).toBe(null)
  })
})
