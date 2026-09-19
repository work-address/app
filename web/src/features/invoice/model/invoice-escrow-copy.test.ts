import { describe, expect, it } from 'vitest'

import type {
  InvoiceEscrowFigureId,
  InvoiceEscrowState,
  InvoiceStatus,
} from './invoice-escrow'

import en from '@/shared/i18n/locales/en.json'
import es from '@/shared/i18n/locales/es.json'
import ja from '@/shared/i18n/locales/ja.json'
import ru from '@/shared/i18n/locales/ru.json'
import zh from '@/shared/i18n/locales/zh.json'

const LOCALES: Record<string, Record<string, string>> = { en, es, ja, ru, zh }

/**
 * Every value the settlement and the badge can show. Records rather than
 * arrays, so adding a state or figure to the model fails to compile here
 * until its copy is checked too.
 */
const STATES: Record<InvoiceEscrowState, true> = {
  pending: true,
  submitted: true,
  released: true,
  disputed: true,
  expired: true,
  cancelled: true,
}

const FIGURES: Record<InvoiceEscrowFigureId, true> = {
  gross: true,
  fee: true,
  net: true,
  refunded: true,
}

const STATUSES: Record<InvoiceStatus, string> = {
  paid: 'invoice.state.paid',
  requested: 'invoice.state.requested',
  refunded: 'invoice.state.refunded',
}

const KEYS = [
  'invoice.escrow.heading',
  'invoice.escrow.description',
  'invoice.escrow.confirmedAt',
  'invoice.escrow.transaction',
  'invoice.escrow.viewTransaction',
  ...Object.keys(STATES).map((state) => `invoice.escrow.state.${state}`),
  ...Object.keys(FIGURES).map((figure) => `invoice.escrow.figure.${figure}`),
  ...Object.values(STATUSES),
]

describe('escrow settlement copy', () => {
  it.each(Object.keys(LOCALES))('%s: has every string it shows', (lang) => {
    for (const key of KEYS) {
      expect(LOCALES[lang][key], key).toEqual(expect.any(String))
      expect(LOCALES[lang][key].trim(), key).not.toBe('')
    }
  })

  it.each(['es', 'ja', 'ru', 'zh'])(
    '%s: is translated, not English',
    (lang) => {
      for (const key of KEYS) {
        expect(LOCALES[lang][key], key).not.toBe(en[key as keyof typeof en])
      }
    },
  )

  it.each(Object.keys(LOCALES))(
    '%s: states the 95/5 split the escrow pays',
    (lang) => {
      expect(LOCALES[lang]['invoice.escrow.figure.fee']).toContain('5')
      expect(LOCALES[lang]['invoice.escrow.figure.net']).toContain('95')
    },
  )
})
