import { describe, expect, it } from 'vitest'

import { getTimeSelectAllState, toggleTimeSelectAll } from './time-select-all'

describe('getTimeSelectAllState', () => {
  it('is off with nothing loaded or nothing selected', () => {
    expect(getTimeSelectAllState([], {})).toBe(false)
    expect(getTimeSelectAllState(['a', 'b'], {})).toBe(false)
    expect(getTimeSelectAllState(['a', 'b'], { a: false })).toBe(false)
  })

  it('is indeterminate while only some loaded entries are selected', () => {
    expect(getTimeSelectAllState(['a', 'b'], { a: true })).toBe('indeterminate')
  })

  it('is on once every loaded entry is selected', () => {
    expect(getTimeSelectAllState(['a', 'b'], { a: true, b: true })).toBe(true)
  })

  it('ignores selected ids that are not loaded', () => {
    expect(getTimeSelectAllState(['a'], { a: true, gone: true })).toBe(true)
    expect(getTimeSelectAllState(['a'], { gone: true })).toBe(false)
  })
})

describe('toggleTimeSelectAll', () => {
  it('selects every loaded entry from none or some', () => {
    expect(toggleTimeSelectAll(['a', 'b'], {})).toEqual({ a: true, b: true })
    expect(toggleTimeSelectAll(['a', 'b'], { a: true })).toEqual({
      a: true,
      b: true,
    })
  })

  it('clears the selection when everything was selected', () => {
    expect(toggleTimeSelectAll(['a', 'b'], { a: true, b: true })).toEqual({})
  })
})
