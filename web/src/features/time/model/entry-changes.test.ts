import { describe, expect, it } from 'vitest'

import { getEntryChanges, hasInvoicedEntry } from './entry-changes'

import type { Time } from '@/entities/time'

const by = (id: string, isInvoiced = false) =>
  ({ isInvoiced, user: { id } }) as Pick<Time, 'isInvoiced' | 'user'>

describe('getEntryChanges', () => {
  it('lets an author change everything on an entry on no invoice', () => {
    expect(getEntryChanges(by('me'), 'me')).toEqual({
      isAuthor: true,
      canMarkPaid: true,
      canEditNote: true,
      canRemove: true,
    })
  })

  it('leaves an author only the paid state once invoiced', () => {
    expect(getEntryChanges(by('me', true), 'me')).toEqual({
      isAuthor: true,
      canMarkPaid: true,
      canEditNote: false,
      canRemove: false,
    })
  })

  it('offers nothing to anyone else', () => {
    expect(getEntryChanges(by('them'), 'me')).toEqual({
      isAuthor: false,
      canMarkPaid: false,
      canEditNote: false,
      canRemove: false,
    })
  })

  it('offers nothing before the reader or the author is known', () => {
    expect(getEntryChanges(by('me')).isAuthor).toBe(false)
    expect(getEntryChanges({}, 'me').isAuthor).toBe(false)
    expect(getEntryChanges({}).isAuthor).toBe(false)
  })
})

describe('hasInvoicedEntry', () => {
  const rows = [
    { id: 'a', isInvoiced: false },
    { id: 'b', isInvoiced: true },
  ] as Pick<Time, 'id' | 'isInvoiced'>[]

  it('looks only at what is selected', () => {
    expect(hasInvoicedEntry(rows, ['a'])).toBe(false)
    expect(hasInvoicedEntry(rows, ['a', 'b'])).toBe(true)
    expect(hasInvoicedEntry(rows, [])).toBe(false)
  })

  it('leaves entries no longer loaded to the API', () => {
    expect(hasInvoicedEntry(rows, ['gone'])).toBe(false)
  })
})
