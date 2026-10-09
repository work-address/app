import { AxiosError } from 'axios'
import { allSettled, fork } from 'effector'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { $invoiceReloadThroughPage } from './list.stores'

import {
  $invoicePage,
  $invoices,
  $invoicesTotal,
  $invoiceSettlementPendingIds,
  fetchInvoiceList,
  invoiceListQuery,
  invoiceSettlementRequested,
  invoiceStateFilterChanged,
  loadMoreInvoices,
} from './index'

const { paid, unpaid, search, toast, suppressed } = vi.hoisted(() => ({
  paid: vi.fn(),
  unpaid: vi.fn(),
  search: vi.fn(),
  toast: vi.fn(),
  suppressed: vi.fn(),
}))
vi.mock('@/shared', async () => {
  const { createEffect } = await import('effector')
  const { runApiData } = await import('@/shared/lib/api')
  const { collectSearchPages } = await import(
    '@/shared/lib/collect-search-pages'
  )
  return {
    baseApi: {
      invoiceControllerMarkPaid: paid,
      invoiceControllerMarkUnpaid: unpaid,
      invoiceControllerSearch: search,
    },
    runApiData,
    collectSearchPages,
    showToastFx: createEffect((request: unknown) => toast(request)),
    navigateFx: createEffect(() => {}),
    suppressGlobalErrorToast: suppressed,
    getLoadFailureKind: () => 'failed',
  }
})
vi.mock('@/entities/profile', async () => {
  const { createStore } = await import('effector')
  return { $user: createStore(null) }
})

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}
const row = (id: string, state = 'Requested') => ({
  id,
  state,
  project: { id: 'project' },
})

beforeEach(() => {
  paid.mockReset()
  unpaid.mockReset()
  search.mockReset()
  toast.mockReset()
  suppressed.mockReset()
  search.mockResolvedValue({ data: [[], 0] })
})

describe('invoice settlement model', () => {
  it('guards paid and unpaid by invoice id and emits one toast per completed request', async () => {
    const scope = fork()
    const first = deferred<{ data: ReturnType<typeof row> }>()
    const second = deferred<{ data: ReturnType<typeof row> }>()
    paid.mockReturnValue(first.promise)
    unpaid.mockReturnValue(second.promise)
    const operations = [
      allSettled(invoiceSettlementRequested, {
        scope,
        params: { id: 'a', isPaid: true },
      }),
      allSettled(invoiceSettlementRequested, {
        scope,
        params: { id: 'a', isPaid: false },
      }),
      allSettled(invoiceSettlementRequested, {
        scope,
        params: { id: 'b', isPaid: false },
      }),
    ]
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(paid).toHaveBeenCalledTimes(1)
    expect(unpaid).toHaveBeenCalledTimes(1)
    expect(scope.getState($invoiceSettlementPendingIds)).toEqual({
      a: true,
      b: true,
    })
    first.resolve({ data: row('a', 'PAID') })
    second.resolve({ data: row('b') })
    await Promise.all(operations)
    expect(scope.getState($invoiceSettlementPendingIds)).toEqual({})
    expect(toast.mock.calls.map(([request]) => request.messageKey)).toEqual([
      'invoice.payment.markedPaid',
      'invoice.payment.markedUnpaid',
    ])
  })

  it('reports a failure once, clears pending and leaves the row unchanged', async () => {
    const scope = fork()
    search.mockResolvedValue({ data: [[row('a')], 1] })
    await allSettled(fetchInvoiceList, { scope })
    paid.mockResolvedValue(new AxiosError('Offline', 'ERR_NETWORK'))
    await allSettled(invoiceSettlementRequested, {
      scope,
      params: { id: 'a', isPaid: true },
    })
    expect(scope.getState($invoices)).toEqual([row('a')])
    expect(scope.getState($invoiceSettlementPendingIds)).toEqual({})
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast.mock.calls[0][0]).toEqual({
      type: 'error',
      messageKey: 'invoice.payment.failed',
    })
    expect(suppressed).toHaveBeenCalledTimes(1)
  })

  it('refills two filtered pages and never skips the next boundary invoice', async () => {
    const scope = fork()
    const server = Array.from({ length: 60 }, (_, index) => row(String(index)))
    search.mockImplementation(({ body }) => {
      const matching = server.filter(
        (item) => !body.filter.state || item.state === body.filter.state,
      )
      return Promise.resolve({
        data: [
          matching.slice(body.page * body.limit, (body.page + 1) * body.limit),
          matching.length,
        ],
      })
    })
    await allSettled(invoiceStateFilterChanged, { scope, params: 'Requested' })
    await allSettled(loadMoreInvoices, { scope })
    paid.mockImplementation(({ path }) => {
      const invoice = server.find((item) => item.id === path.id)!
      invoice.state = 'PAID'
      return Promise.resolve({
        data: { ...invoice, paidAt: '2026-10-05T12:00:00Z' },
      })
    })
    await allSettled(invoiceSettlementRequested, {
      scope,
      params: { id: '0', isPaid: true },
    })
    expect(scope.getState($invoices).map((item) => item.id)).toEqual(
      server.slice(1, 41).map((item) => item.id),
    )
    expect(scope.getState($invoicesTotal)).toBe(59)
    expect(scope.getState($invoicePage)).toBe(1)
    await allSettled(loadMoreInvoices, { scope })
    expect(scope.getState($invoices).map((item) => item.id)).toEqual(
      server.slice(1).map((item) => item.id),
    )
    expect(toast).toHaveBeenCalledTimes(1)
  })

  it('handles concurrent outgoing settlements beyond a page without an offset gap', async () => {
    const scope = fork()
    const server = Array.from({ length: 100 }, (_, index) => row(String(index)))
    search.mockImplementation(({ body }) => {
      const matching = server.filter(
        (item) => !body.filter.state || item.state === body.filter.state,
      )
      return Promise.resolve({
        data: [
          matching
            .slice(body.page * body.limit, (body.page + 1) * body.limit)
            .map((item) => ({ ...item })),
          matching.length,
        ],
      })
    })
    await allSettled(invoiceStateFilterChanged, { scope, params: 'Requested' })
    await allSettled(loadMoreInvoices, { scope })
    paid.mockImplementation(({ path }) => {
      const invoice = server.find((item) => item.id === path.id)!
      invoice.state = 'PAID'
      return Promise.resolve({ data: { ...invoice } })
    })
    await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        allSettled(invoiceSettlementRequested, {
          scope,
          params: { id: String(index), isPaid: true },
        }),
      ),
    )
    expect(scope.getState($invoices).map((item) => item.id)).toEqual(
      server.slice(25, 65).map((item) => item.id),
    )
    expect(scope.getState($invoicesTotal)).toBe(75)
    expect(scope.getState($invoicePage)).toBe(1)
    await allSettled(loadMoreInvoices, { scope })
    expect(scope.getState($invoices)[40].id).toBe('65')
    expect(toast).toHaveBeenCalledTimes(25)
    expect(scope.getState($invoiceSettlementPendingIds)).toEqual({})
  })

  it('keeps loaded rows on refill failure, blocks append, and retries the same page span', async () => {
    const scope = fork()
    const server = Array.from({ length: 60 }, (_, index) => row(String(index)))
    let failReload = false
    search.mockImplementation(({ body }) => {
      if (failReload && body.limit === 20 && body.page === 1) {
        return Promise.resolve(new AxiosError('Offline', 'ERR_NETWORK'))
      }
      const matching = server.filter(
        (item) => !body.filter.state || item.state === body.filter.state,
      )
      return Promise.resolve({
        data: [
          matching.slice(body.page * body.limit, (body.page + 1) * body.limit),
          matching.length,
        ],
      })
    })
    await allSettled(invoiceStateFilterChanged, { scope, params: 'Requested' })
    await allSettled(loadMoreInvoices, { scope })
    paid.mockImplementation(() => {
      server[0].state = 'PAID'
      failReload = true
      return Promise.resolve({ data: server[0] })
    })
    await allSettled(invoiceSettlementRequested, {
      scope,
      params: { id: '0', isPaid: true },
    })
    expect(scope.getState(invoiceListQuery.$failed)).toBe(true)
    expect(scope.getState($invoices)).toHaveLength(39)
    expect(scope.getState($invoiceReloadThroughPage)).toBe(1)
    const count = search.mock.calls.length
    await allSettled(loadMoreInvoices, { scope })
    expect(search.mock.calls).toHaveLength(count)
    failReload = false
    await allSettled(fetchInvoiceList, { scope })
    expect(scope.getState(invoiceListQuery.$failed)).toBe(false)
    expect(scope.getState($invoices)).toHaveLength(40)
    expect(scope.getState($invoicePage)).toBe(1)
    expect(scope.getState($invoiceReloadThroughPage)).toBeNull()
    expect(scope.getState($invoicesTotal)).toBe(59)
  })
})
