import { describe, expect, it } from 'vitest'

import { formatCents, formatMinutes, shortenAddress } from './format'

describe('formatCents', () => {
  it('turns whole cents into dollars with two places', () => {
    expect(formatCents(0)).toBe('$0.00')
    expect(formatCents(5)).toBe('$0.05')
    expect(formatCents(3000)).toBe('$30.00')
    expect(formatCents(123_450)).toBe('$1234.50')
  })

  /**
   * The API serialises `amountCents` as a string, and a stray fraction must
   * not invent a cent: the stored value is whole cents, so anything after
   * the point is dropped, never rounded up into money nobody billed.
   */
  it('takes the string the API sends and never rounds a cent into being', () => {
    expect(formatCents('250000' as unknown as number)).toBe('$2500.00')
    expect(formatCents(1999.9)).toBe('$19.99')
  })

  /** Integer cents stay exact where a float sum of dollars drifts. */
  it('is exact where adding dollars as floats is not', () => {
    expect(0.1 + 0.2).not.toBe(0.3)
    expect(formatCents(10 + 20)).toBe('$0.30')
  })
})

describe('formatMinutes', () => {
  const t = (key: string, params?: Record<string, unknown>) =>
    `${key}:${JSON.stringify(params)}`

  it('says hours, minutes, or both', () => {
    expect(formatMinutes(45, t)).toBe(
      'common.duration.minutesOnly:{"minutes":45}',
    )
    expect(formatMinutes(120, t)).toBe('common.duration.hoursOnly:{"hours":2}')
    expect(formatMinutes(200, t)).toBe(
      'common.duration.hoursAndMinutes:{"hours":3,"minutes":20}',
    )
  })
})

describe('shortenAddress', () => {
  it('keeps a short address whole and elides a long one', () => {
    expect(shortenAddress('0x1234')).toBe('0x1234')
    expect(shortenAddress(`0x${'ab'.repeat(20)}`)).toBe('0xabab…abab')
  })
})
