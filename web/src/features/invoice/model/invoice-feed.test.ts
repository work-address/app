import { describe, expect, it, vi } from 'vitest'

import {
  applyInvoiceSettlement,
  readInvoiceSettlement,
  readLoadedInvoicePages,
} from './invoice-feed'

const row = (id: string, state = 'Requested') => ({
  id,
  state,
  project: { id: 'project' },
})

describe('invoice feed settlement', () => {
  it('uses the returned state and timestamp for repeated idempotent successes', () => {
    const invoice = readInvoiceSettlement('a', {
      ...row('a', 'PAID'),
      paidAt: '2026-10-05T12:00:00Z',
    })
    const once = applyInvoiceSettlement([row('a')], invoice, {})
    expect(applyInvoiceSettlement(once, invoice, {})).toEqual(once)
    expect(once[0].paidAt).toBe('2026-10-05T12:00:00Z')
    expect(once[0].state).toBe('PAID')
  })

  it('removes a settled row that leaves the active filter and keeps other rows', () => {
    const invoice = readInvoiceSettlement('a', row('a', 'PAID'))
    expect(
      applyInvoiceSettlement([row('a'), row('b')], invoice, {
        state: 'Requested',
      }),
    ).toEqual([row('b')])
  })

  it('reloads all loaded pages after more than a page of rows leaves', async () => {
    const remaining = Array.from({ length: 75 }, (_, index) =>
      row(String(index + 25)),
    )
    const fetchPage = vi.fn(async (page: number) => ({
      items: remaining.slice(page * 20, (page + 1) * 20),
      total: remaining.length,
    }))
    const prefix = await readLoadedInvoicePages(fetchPage, 1, 20)
    const next = await fetchPage(prefix.page + 1)
    expect(prefix.items.map((item) => item.id)).toEqual(
      remaining.slice(0, 40).map((item) => item.id),
    )
    expect(next.items[0].id).toBe('65')
    expect(prefix.total).toBe(75)
    expect(prefix.page).toBe(1)
  })

  it('shrinks the last-page index when fewer invoices remain', async () => {
    const result = await readLoadedInvoicePages(
      async () => ({ items: [row('a')], total: 1 }),
      3,
      20,
    )
    expect(result).toEqual({ items: [row('a')], total: 1, page: 0 })
  })

  it('rejects a partial reload failure instead of publishing one page', async () => {
    const failure = new Error('Offline')
    await expect(
      readLoadedInvoicePages(
        async (page) => {
          if (page > 0) {
            throw failure
          }
          return {
            items: Array.from({ length: 20 }, (_, index) => row(String(index))),
            total: 40,
          }
        },
        1,
        20,
      ),
    ).rejects.toBe(failure)
  })
})
