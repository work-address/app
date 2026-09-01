import { describe, expect, it } from 'vitest'

import {
  DEFAULT_TIME_SORT_FIELD,
  DEFAULT_TIME_SORT_ORDER,
  getTimeSortField,
  getTimeSortOrder,
  TIME_SORT_FIELDS,
  toTimeSort,
} from './time-sort'

describe('getTimeSortField', () => {
  it('names the column the feed is ordered by', () => {
    expect(getTimeSortField({ minutesActive: 'ASC' })).toBe('minutesActive')
  })

  it('falls back to the default when nothing is set', () => {
    expect(getTimeSortField({})).toBe(DEFAULT_TIME_SORT_FIELD)
  })

  it('ignores keys that are not sortable columns', () => {
    expect(getTimeSortField({ somethingElse: 'ASC' })).toBe(
      DEFAULT_TIME_SORT_FIELD,
    )
  })

  it('prefers the first known field over key enumeration order', () => {
    // appendTimeSort merges, so more than one key can be present; the answer
    // has to be stable rather than whatever the object lists first.
    const sort = { mouseKeys: 'ASC' as const, fromAt: 'DESC' as const }

    expect(getTimeSortField(sort)).toBe('fromAt')
  })
})

describe('getTimeSortOrder', () => {
  it('reads the direction of the sorted column', () => {
    expect(getTimeSortOrder({ note: 'ASC' })).toBe('ASC')
    expect(getTimeSortOrder({ note: 'DESC' })).toBe('DESC')
  })

  it('falls back to the default when nothing is set', () => {
    expect(getTimeSortOrder({})).toBe(DEFAULT_TIME_SORT_ORDER)
  })
})

describe('toTimeSort', () => {
  it('replaces the sort rather than merging into it', () => {
    expect(toTimeSort('keyboardKeys', 'ASC')).toEqual({ keyboardKeys: 'ASC' })
  })

  it('round-trips through the readers for every offered field', () => {
    for (const { field } of TIME_SORT_FIELDS) {
      const sort = toTimeSort(field, 'ASC')

      expect(getTimeSortField(sort)).toBe(field)
      expect(getTimeSortOrder(sort)).toBe('ASC')
    }
  })
})
