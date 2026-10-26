import { format } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { formatDateRange } from './format-date-range'

const plain = (date: Date, pattern: string) => format(date, pattern)

describe('formatDateRange', () => {
  it('says the month and year once inside a month', () => {
    expect(
      formatDateRange(new Date(2026, 9, 12), new Date(2026, 9, 18), plain),
    ).toBe('12th – 18th Oct 2026')
  })

  it('says the year once inside a year', () => {
    expect(
      formatDateRange(new Date(2026, 8, 28), new Date(2026, 9, 4), plain),
    ).toBe('28th Sep – 4th Oct 2026')
  })

  it('spells both dates out across years', () => {
    expect(
      formatDateRange(new Date(2025, 11, 29), new Date(2026, 0, 2), plain),
    ).toBe('29th Dec 2025 – 2nd Jan 2026')
  })

  it('keeps a single day as a range of one', () => {
    expect(
      formatDateRange(new Date(2026, 9, 12), new Date(2026, 9, 12), plain),
    ).toBe('12th – 12th Oct 2026')
  })
})
