import { describe, expect, it } from 'vitest'

import {
  PROFILE_VISIBILITY_COPY_KEYS,
  PROFILE_VISIBILITY_HINT_KEY,
  profileVisibility,
} from './profile-visibility'

import en from '@/shared/i18n/locales/en.json'
import es from '@/shared/i18n/locales/es.json'
import ja from '@/shared/i18n/locales/ja.json'
import ru from '@/shared/i18n/locales/ru.json'
import zh from '@/shared/i18n/locales/zh.json'

const LOCALES: Record<string, Record<string, string>> = { en, es, ja, ru, zh }

describe('profileVisibility', () => {
  it('is hidden only when the holder hid it', () => {
    expect(profileVisibility(false)).toBe('hidden')
    expect(profileVisibility(true)).toBe('public')
  })

  it('reads a record without the flag as public, as it was before', () => {
    const legacy: { visible?: boolean | null } = {}

    expect(profileVisibility(legacy.visible)).toBe('public')
    expect(profileVisibility(null)).toBe('public')
  })

  it('has one hint per state', () => {
    expect(PROFILE_VISIBILITY_HINT_KEY.public).not.toBe(
      PROFILE_VISIBILITY_HINT_KEY.hidden,
    )
  })
})

describe('profile visibility copy', () => {
  it.each(Object.keys(LOCALES))('%s: has every string it shows', (lang) => {
    for (const key of PROFILE_VISIBILITY_COPY_KEYS) {
      expect(LOCALES[lang][key], key).toEqual(expect.any(String))
      expect(LOCALES[lang][key].trim(), key).not.toBe('')
    }
  })

  it.each(['es', 'ja', 'ru', 'zh'])(
    '%s: is translated, not English',
    (lang) => {
      for (const key of PROFILE_VISIBILITY_COPY_KEYS) {
        expect(LOCALES[lang][key], key).not.toBe(en[key as keyof typeof en])
      }
    },
  )

  it('tells the holder that hiding leaves the chain record alone', () => {
    expect(en['profile.visibility.chainNote']).toMatch(/on chain/)
    expect(en['profile.visibility.chainNote']).toMatch(/does not withdraw/)
  })
})
