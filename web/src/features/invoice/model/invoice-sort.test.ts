import { allSettled, fork } from 'effector'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  $invoices,
  $invoiceSort,
  fetchInvoiceList,
  invoiceListQuery,
  invoiceSortChanged,
  loadMoreInvoices,
} from './index'

const { search } = vi.hoisted(() => ({ search: vi.fn() }))
vi.mock('@/shared', async () => {
  const { createEffect } = await import('effector')
  const { runApiData } = await import('@/shared/lib/api')
  const { collectSearchPages } = await import(
    '@/shared/lib/collect-search-pages'
  )
  return {
    baseApi: { invoiceControllerSearch: search },
    runApiData,
    collectSearchPages,
    showToastFx: createEffect(() => {}),
    navigateFx: createEffect(() => {}),
    suppressGlobalErrorToast: vi.fn(),
    getLoadFailureKind: () => 'failed',
  }
})

vi.mock('@/entities/profile', async () => {
  const { createStore } = await import('effector')
  return { $user: createStore(null) }
})

const answer = (ids: string[], total: number) => ({
  data: [ids.map((id) => ({ id })), total],
})

const isSummaryRequest = (body: { sort: { id?: string } }) =>
  body.sort.id !== undefined

/**
 * Answers the list's requests in turn. The strip's totals use the same search
 * endpoint on every first load, so those are told apart and left out.
 */
const answerListWith = (...answers: unknown[]) => {
  search.mockImplementation(({ body }) =>
    Promise.resolve(
      isSummaryRequest(body) ? { data: [[], 0] } : answers.shift(),
    ),
  )
}

const sentToList = () =>
  search.mock.calls
    .map(([request]) => request.body)
    .filter((body) => !isSummaryRequest(body))

const shownIds = (scope: ReturnType<typeof fork>) =>
  scope.getState($invoices).map((row) => row.id)

describe('sorting the invoice list', () => {
  beforeEach(() => {
    search.mockReset()
  })

  it('asks the server for the new order from the first page', async () => {
    const scope = fork()
    answerListWith(answer(['a'], 2), answer(['b'], 2))

    await allSettled(fetchInvoiceList, { scope })
    await allSettled(invoiceSortChanged, {
      scope,
      params: { amountCents: 'DESC' },
    })

    const [first, sorted] = sentToList()
    expect(first).toMatchObject({ sort: { createdAt: 'DESC' }, page: 0 })
    expect(sorted).toMatchObject({ sort: { amountCents: 'DESC' }, page: 0 })
    expect(scope.getState($invoiceSort)).toEqual({ amountCents: 'DESC' })
    expect(shownIds(scope)).toEqual(['b'])
  })

  it('keeps the rows on screen until the new order lands', async () => {
    const scope = fork()
    let land = (_: unknown) => {}
    const late = new Promise((resolve) => {
      land = resolve
    })
    answerListWith(answer(['a'], 1), late)

    await allSettled(fetchInvoiceList, { scope })
    const sorted = allSettled(invoiceSortChanged, {
      scope,
      params: { state: 'ASC' },
    })

    expect(scope.getState(invoiceListQuery.$pending)).toBe(true)
    expect(shownIds(scope)).toEqual(['a'])

    land(answer(['z'], 1))
    await sorted
    expect(shownIds(scope)).toEqual(['z'])
  })

  it('loads further pages in the order on screen', async () => {
    const scope = fork()
    answerListWith(answer(['a'], 3), answer(['b'], 3), answer(['c'], 3))

    await allSettled(fetchInvoiceList, { scope })
    await allSettled(invoiceSortChanged, {
      scope,
      params: { projectName: 'ASC' },
    })
    await allSettled(loadMoreInvoices, { scope })

    expect(sentToList()[2]).toMatchObject({
      sort: { projectName: 'ASC' },
      page: 1,
    })
    expect(shownIds(scope)).toEqual(['b', 'c'])
  })
})
