import { describe, expect, it } from 'vitest'

import { formatCompactDurationFromMinutes } from './format-compact-duration'

describe('compact duration', () => {
  it.each([
    [0, '0m'],
    [20, '20m'],
    [120, '2h'],
    [5910, '98h\u202f30m'],
    [59.49, '59m'],
    [59.5, '1h'],
    [-5, '0m'],
    [Number.NaN, '0m'],
    [Number.POSITIVE_INFINITY, '0m'],
  ])(
    'formats %s minutes without losing rounding or zero semantics',
    (minutes, expected) => {
      expect(formatCompactDurationFromMinutes(minutes, 'en')).toBe(expected)
    },
  )

  it('uses the active locale’s narrow units', () => {
    expect(formatCompactDurationFromMinutes(5910, 'ru')).toBe('98ч\u202f30мин')
    expect(formatCompactDurationFromMinutes(75, 'fr')).toBe('1h\u202f15min')
  })
})
