import { describe, expect, it } from 'vitest'

import {
  buildInvoiceListFilter,
  EMPTY_INVOICE_AMOUNT,
  EMPTY_INVOICE_PERIOD,
  isInvoiceAmountInput,
  isSameInvoiceAmount,
  readInvoiceAmountCents,
} from './invoice-filter'

const noFilters = {
  projectId: '',
  state: '' as const,
  period: EMPTY_INVOICE_PERIOD,
  amount: EMPTY_INVOICE_AMOUNT,
}

describe('invoice amount input', () => {
  it.each(['', '1', '12.', '12.5', '12,50', '.5'])('accepts %s', (value) => {
    expect(isInvoiceAmountInput(value)).toBe(true)
  })

  it.each(['a', '-1', '1.234', '1.2.3', '1e5'])('refuses %s', (value) => {
    expect(isInvoiceAmountInput(value)).toBe(false)
  })

  it('reads dollars as cents, without float drift', () => {
    expect(readInvoiceAmountCents('19.99')).toBe(1999)
    expect(readInvoiceAmountCents('12,5')).toBe(1250)
    expect(readInvoiceAmountCents('0')).toBe(0)
  })

  it('reads nothing usable as no filter, not as zero', () => {
    expect(readInvoiceAmountCents('')).toBeUndefined()
    expect(readInvoiceAmountCents('.')).toBeUndefined()
  })

  it('compares what the amounts filter on, not how they were typed', () => {
    expect(
      isSameInvoiceAmount({ min: '12', max: '' }, { min: '12.0', max: '.' }),
    ).toBe(true)
    expect(
      isSameInvoiceAmount({ min: '12', max: '' }, { min: '13', max: '' }),
    ).toBe(false)
  })
})

describe('buildInvoiceListFilter', () => {
  it('leaves out everything unset', () => {
    expect(buildInvoiceListFilter(noFilters)).toEqual({})
    expect(Object.keys(buildInvoiceListFilter(noFilters))).toEqual([])
  })

  it('keeps a zero minimum', () => {
    expect(
      buildInvoiceListFilter({
        ...noFilters,
        amount: { min: '0', max: '' },
      }),
    ).toEqual({ amountFrom: 0 })
  })

  it('runs the period through the whole of its last day', () => {
    const from = new Date(2026, 0, 5).getTime()
    const to = new Date(2026, 0, 9).getTime()
    const filter = buildInvoiceListFilter({
      ...noFilters,
      period: { fromAt: from, toAt: to },
    })

    expect(filter.fromAt).toBe(new Date(2026, 0, 5).toISOString())
    expect(filter.toAt).toBe(
      new Date(2026, 0, 9, 23, 59, 59, 999).toISOString(),
    )
  })

  it('carries every filter that is set', () => {
    expect(
      buildInvoiceListFilter({
        ...noFilters,
        projectId: 'project',
        state: 'PAID',
        amount: { min: '10', max: '20.50' },
      }),
    ).toEqual({
      projectId: 'project',
      state: 'PAID',
      amountFrom: 1000,
      amountTo: 2050,
    })
  })
})
