import { allSettled, fork } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import { invoiceListQuery, invoiceSummaryQuery } from './queries'

const { search } = vi.hoisted(() => ({ search: vi.fn() }))
vi.mock('@/shared', async () => {
  const { runApiData } = await import('@/shared/lib/api')
  const { collectSearchPages } = await import(
    '@/shared/lib/collect-search-pages'
  )
  return {
    baseApi: { invoiceControllerSearch: search },
    runApiData,
    collectSearchPages,
  }
})

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

describe('invoice filter concurrency', () => {
  it('ignores an older list response that arrives after a newer state filter', async () => {
    const scope = fork()
    const older = deferred<{ data: [Array<{ id: string }>, number] }>()
    search
      .mockReset()
      .mockImplementation(({ body }) =>
        body.filter.state === 'Requested'
          ? older.promise
          : Promise.resolve({ data: [[{ id: 'paid' }], 1] }),
      )
    const first = allSettled(invoiceListQuery.start, {
      scope,
      params: { state: 'Requested', page: 0 },
    })
    const second = allSettled(invoiceListQuery.start, {
      scope,
      params: { state: 'PAID', page: 0 },
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    older.resolve({ data: [[{ id: 'requested' }], 1] })
    await Promise.all([first, second])
    expect(scope.getState(invoiceListQuery.$data)?.items).toEqual([
      { id: 'paid' },
    ])
  })

  it('reads every summary page and keeps the project filter on every request', async () => {
    const scope = fork()
    const rows = Array.from({ length: 101 }, (_, index) => ({
      id: String(index),
      amountCents: 1,
    }))
    search.mockReset().mockImplementation(({ body }) =>
      Promise.resolve({
        data: [
          rows.slice(body.page * body.limit, (body.page + 1) * body.limit),
          rows.length,
        ],
      }),
    )
    await allSettled(invoiceSummaryQuery.start, {
      scope,
      params: { projectId: 'project-a' },
    })
    expect(scope.getState(invoiceSummaryQuery.$data)).toHaveLength(101)
    expect(search.mock.calls).toHaveLength(2)
    expect(
      search.mock.calls.every(
        ([request]) => request.body.filter.projectId === 'project-a',
      ),
    ).toBe(true)
  })
})
