import { describe, expect, it } from 'vitest'

import { formatCurrency, formatRate } from './intl-formatters'

describe('formatRate', () => {
  it('drops the cents from a whole amount', () => {
    expect(formatRate(80)).toBe('$80')
  })

  it('reads the decimal strings the API sends', () => {
    expect(formatRate('80.00')).toBe('$80')
  })

  it('keeps the cents when there are some', () => {
    expect(formatRate(80.5)).toBe(formatCurrency(80.5))
  })

  it('treats a missing rate as zero', () => {
    expect(formatRate(null)).toBe('$0')
  })
})
