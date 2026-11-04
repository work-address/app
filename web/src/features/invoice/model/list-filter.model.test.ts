import { allSettled, fork } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import {
  $invoiceAmountFilter,
  $invoiceHasActiveFilters,
  $invoiceListFilter,
  invoiceAmountFilterChanged,
  invoiceFiltersReset,
  invoicePeriodFilterChanged,
  invoiceStateFilterChanged,
} from './list.stores'

vi.mock('@/shared', () => ({
  baseApi: {},
  runApiData: vi.fn(),
  collectSearchPages: vi.fn(),
}))

describe('invoice list filter', () => {
  it('shows a typed amount at once and filters on it when typing stops', async () => {
    const scope = fork()

    const typing = allSettled(invoiceAmountFilterChanged, {
      scope,
      params: { min: '12.5' },
    })

    expect(scope.getState($invoiceAmountFilter).min).toBe('12.5')
    expect(scope.getState($invoiceListFilter)).toEqual({})

    await typing

    expect(scope.getState($invoiceListFilter)).toEqual({ amountFrom: 1250 })
    expect(scope.getState($invoiceHasActiveFilters)).toBe(true)
  })

  it('does not bring back an amount a reset cut short', async () => {
    const scope = fork()

    const typing = allSettled(invoiceAmountFilterChanged, {
      scope,
      params: { max: '99' },
    })
    await allSettled(invoiceFiltersReset, { scope })
    await typing

    expect(scope.getState($invoiceAmountFilter)).toEqual({ min: '', max: '' })
    expect(scope.getState($invoiceListFilter)).toEqual({})
    expect(scope.getState($invoiceHasActiveFilters)).toBe(false)
  })

  it('clears every filter on reset', async () => {
    const scope = fork()

    await allSettled(invoiceStateFilterChanged, { scope, params: 'PAID' })
    await allSettled(invoicePeriodFilterChanged, {
      scope,
      params: { fromAt: new Date(2026, 0, 5).getTime() },
    })
    await allSettled(invoiceAmountFilterChanged, {
      scope,
      params: { min: '10' },
    })
    expect(Object.keys(scope.getState($invoiceListFilter)).sort()).toEqual([
      'amountFrom',
      'fromAt',
      'state',
    ])

    await allSettled(invoiceFiltersReset, { scope })

    expect(scope.getState($invoiceListFilter)).toEqual({})
  })
})
