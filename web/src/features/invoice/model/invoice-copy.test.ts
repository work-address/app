import { describe, expect, it } from 'vitest'

import en from '@/shared/i18n/locales/en.json'
import es from '@/shared/i18n/locales/es.json'
import ja from '@/shared/i18n/locales/ja.json'
import ru from '@/shared/i18n/locales/ru.json'
import zh from '@/shared/i18n/locales/zh.json'

const LOCALES: Record<string, Record<string, string>> = { en, es, ja, ru, zh }

/**
 * The strings the invoice page shows for a fixed-price bill, which none of
 * the hourly copy covers: what it is billing for, and that its price is
 * fixed rather than an hourly rate of zero.
 */
const KEYS = [
  'invoice.billingFor',
  'invoice.fields.rateFixed',
  'invoice.metricDesc.rateFixed',
  'invoices.item.fixedPrice',
]

describe('fixed-price invoice copy', () => {
  it.each(Object.keys(LOCALES))('%s: has every string it shows', (lang) => {
    for (const key of KEYS) {
      expect(LOCALES[lang][key], key).toEqual(expect.any(String))
      expect(LOCALES[lang][key].trim(), key).not.toBe('')
    }
  })

  /**
   * A real translation, not the English copied across. English is the source,
   * so it is compared against the others rather than itself.
   */
  it.each(Object.keys(LOCALES).filter((lang) => lang !== 'en'))(
    '%s: is translated rather than left in English',
    (lang) => {
      for (const key of KEYS) {
        expect(LOCALES[lang][key], key).not.toBe(LOCALES.en[key])
      }
    },
  )
})
