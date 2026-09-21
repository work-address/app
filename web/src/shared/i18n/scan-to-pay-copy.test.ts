import { describe, expect, it } from 'vitest'

import en from './locales/en.json'
import es from './locales/es.json'
import ja from './locales/ja.json'
import ru from './locales/ru.json'
import zh from './locales/zh.json'

const LOCALES: Record<string, Record<string, string>> = { en, es, ja, ru, zh }

/**
 * How each locale says "scan" and "pay". A string that says both is telling
 * the reader a scan will make a payment.
 */
const WORDS: Record<string, { scan: RegExp; pay: RegExp }> = {
  en: { scan: /\bscan/i, pay: /\bpa(y|id)\b|\bpayment/i },
  es: { scan: /escane/i, pay: /\bpag[ao]|\bpaga/i },
  ja: { scan: /スキャン|読み取/, pay: /支払|払い|送金/ },
  ru: { scan: /скан/i, pay: /оплат|плат[еиё]/i },
  zh: { scan: /扫/, pay: /付款|支付|付到/ },
}

/**
 * The only strings allowed to say both, and why: the profile's QR code is the
 * holder's wallet address, so a wallet that scans it really does open a
 * transfer to that address - the payer still chooses the amount and
 * confirms it. Anything added here needs the same argument.
 */
const HONEST_SCAN_TO_PAY = new Set([
  'profile.view.qrModal.title',
  'profile.view.qrModal.description',
])

/**
 * WP-98 (INV-09, option A): the invoice QR carries the invoice's reference,
 * which no wallet can pay, so no string may promise that scanning it pays.
 */
describe('no copy promises a payment a scan cannot make', () => {
  it.each(Object.keys(LOCALES))('%s', (lang) => {
    const { scan, pay } = WORDS[lang]
    const offenders = Object.entries(LOCALES[lang])
      .filter(([key]) => !HONEST_SCAN_TO_PAY.has(key))
      .filter(([, text]) => scan.test(text) && pay.test(text))
      .map(([key]) => key)

    expect(offenders).toEqual([])
  })

  /** The regexes are not vacuous: each catches the old invoice caption. */
  it.each([
    ['en', 'Scan QR code and pay in {{currency}}'],
    ['es', 'Escanea el código QR y paga en {{currency}}'],
    ['ja', 'QR コードをスキャンして {{currency}} で支払う'],
    ['ru', 'Отсканируйте QR-код и оплатите в {{currency}}'],
    ['zh', '扫描二维码并使用 {{currency}} 支付'],
  ])('%s would catch the old caption', (lang, caption) => {
    expect(WORDS[lang].scan.test(caption)).toBe(true)
    expect(WORDS[lang].pay.test(caption)).toBe(true)
  })

  it.each(Object.keys(LOCALES))(
    '%s: labels the code as a reference',
    (lang) => {
      for (const key of ['invoice.reference.label', 'invoice.reference.hint']) {
        expect(LOCALES[lang][key], key).toEqual(expect.any(String))
        expect(LOCALES[lang][key].trim(), key).not.toBe('')

        if (lang !== 'en') {
          expect(LOCALES[lang][key], key).not.toBe(LOCALES.en[key])
        }
      }
    },
  )
})
