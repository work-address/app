import { describe, expect, it } from 'vitest'

import { IDENTITY_COPY_KEYS, IDENTITY_FIELD_LABEL_KEY } from './identity-copy'

import en from '@/shared/i18n/locales/en.json'
import es from '@/shared/i18n/locales/es.json'
import ja from '@/shared/i18n/locales/ja.json'
import ru from '@/shared/i18n/locales/ru.json'
import zh from '@/shared/i18n/locales/zh.json'
import { PROFILE_SCHEMA_V1 } from '@/shared/vendor/identity'

const LOCALES: Record<string, Record<string, string>> = { en, es, ja, ru, zh }

const ALL_KEYS = [
  ...IDENTITY_COPY_KEYS,
  ...Object.values(IDENTITY_FIELD_LABEL_KEY),
]

describe('identity copy', () => {
  it.each(Object.keys(LOCALES))('%s: has every string it shows', (lang) => {
    for (const key of ALL_KEYS) {
      expect(LOCALES[lang][key], `${lang} ${key}`).toEqual(expect.any(String))
      expect(LOCALES[lang][key].trim(), `${lang} ${key}`).not.toBe('')
    }
  })

  it.each(['es', 'ja', 'ru', 'zh'])(
    '%s: is translated, not English',
    (lang) => {
      for (const key of IDENTITY_COPY_KEYS) {
        expect(LOCALES[lang][key], `${lang} ${key}`).not.toBe(
          en[key as keyof typeof en],
        )
      }
    },
  )

  it('names every schema v1 field with the label the profile form uses', () => {
    expect(Object.keys(IDENTITY_FIELD_LABEL_KEY).sort()).toEqual(
      PROFILE_SCHEMA_V1.map(({ key }) => key).sort(),
    )

    for (const key of Object.values(IDENTITY_FIELD_LABEL_KEY)) {
      expect(key.startsWith('profile.'), key).toBe(true)
    }
  })

  it('tells the holder the operator can open every field it holds the salts for', () => {
    expect(en['identity.card.custody']).toMatch(/salt/i)
    expect(en['identity.card.custody']).toMatch(/operator|we can|this service/i)
  })

  it('says a publish cannot be taken back off the chain', () => {
    expect(en['identity.permanence.body']).toMatch(/permanent|forever|stays/i)
    expect(en['identity.permanence.body']).toMatch(/withdraw/i)
  })

  it('never offers the same words for two different outcomes', () => {
    const english = IDENTITY_COPY_KEYS.map(
      (key) => en[key as keyof typeof en] as string,
    )

    expect(new Set(english).size).toBe(english.length)
  })
})
