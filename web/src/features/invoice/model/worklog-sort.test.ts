import { describe, expect, it, vi } from 'vitest'

import { sortInvoiceWorklogs } from './worklog-sort'

vi.mock('@/shared', async () => import('@/shared/ui/table/sort-rows'))

const row = (id: string, fields: object) => ({ id, ...fields })
const ids = (rows: { id?: string }[]) => rows.map((entry) => entry.id)

describe('sortInvoiceWorklogs', () => {
  it('orders the date column by when the entry started', () => {
    const rows = [
      row('old', { fromAt: '2026-01-01T00:00:00Z' }),
      row('new', { fromAt: '2026-03-01T00:00:00Z' }),
    ]

    expect(ids(sortInvoiceWorklogs(rows, { createdAt: 'DESC' }))).toEqual([
      'new',
      'old',
    ])
    expect(ids(sortInvoiceWorklogs(rows, { createdAt: 'ASC' }))).toEqual([
      'old',
      'new',
    ])
  })

  it('sorts the active column by its minutes', () => {
    const rows = [
      row('a', { minutesActive: 5 }),
      row('b', { minutesActive: 40 }),
      row('c', { minutesActive: 12 }),
    ]

    expect(ids(sortInvoiceWorklogs(rows, { timeActive: 'DESC' }))).toEqual([
      'b',
      'c',
      'a',
    ])
  })

  it('keeps an entry with no note last in both directions', () => {
    const rows = [
      row('empty', { note: '' }),
      row('b', { note: 'beta' }),
      row('a', { note: 'alpha' }),
    ]

    expect(ids(sortInvoiceWorklogs(rows, { note: 'ASC' }))).toEqual([
      'a',
      'b',
      'empty',
    ])
    expect(ids(sortInvoiceWorklogs(rows, { note: 'DESC' }))).toEqual([
      'b',
      'a',
      'empty',
    ])
  })
})
