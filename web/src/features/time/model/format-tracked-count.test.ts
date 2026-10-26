import { describe, expect, it } from 'vitest'

import { formatTrackedCount } from './format-tracked-count'

const formatter = new Intl.NumberFormat('en', { maximumFractionDigits: 0 })

describe('formatTrackedCount', () => {
  it('groups the digits of a count', () => {
    expect(formatTrackedCount(194_944, formatter)).toBe('194,944')
  })

  it('keeps a zero as a zero', () => {
    expect(formatTrackedCount(0, formatter)).toBe('0')
  })

  it('rounds a distance to whole units', () => {
    expect(formatTrackedCount(2451.7, formatter)).toBe('2,452')
  })

  it('shows a dash for an entry with no count', () => {
    expect(formatTrackedCount(null, formatter)).toBe('—')
    expect(formatTrackedCount(undefined, formatter)).toBe('—')
  })
})
