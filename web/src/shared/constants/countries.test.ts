import { describe, expect, it } from 'vitest'

import {
  COUNTRY_OPTIONS,
  getCountryLabel,
  getCountryOptions,
} from './countries'

describe('localized country names', () => {
  it.each([
    ['en', 'Japan'],
    ['es', 'Japón'],
    ['ja', '日本'],
    ['ru', 'Япония'],
    ['zh', '日本'],
  ])('shows Japan in %s without changing its stored code', (locale, label) => {
    const options = getCountryOptions(locale)

    expect(options.map((option) => option.value)).toEqual(
      COUNTRY_OPTIONS.map((option) => option.value),
    )
    expect(options.find((option) => option.value === 'JP')).toEqual({
      value: 'JP',
      label,
    })
    expect(getCountryLabel('JP', locale)).toBe(label)
  })

  it('preserves source names and values when Intl rejects a locale', () => {
    expect(getCountryOptions('invalid_locale')).toEqual(COUNTRY_OPTIONS)
    expect(getCountryLabel('JP', 'invalid_locale')).toBe('Japan')
    expect(COUNTRY_OPTIONS.find((option) => option.value === 'JP')?.label).toBe(
      'Japan',
    )
  })

  it('keeps empty and unrecognized profile values readable', () => {
    expect(getCountryLabel(null, 'es')).toBe('')
    expect(getCountryLabel('', 'ja')).toBe('')
    expect(getCountryLabel('ZZ', 'ru')).toBe('ZZ')
  })
})
