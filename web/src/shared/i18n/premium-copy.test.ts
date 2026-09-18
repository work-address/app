import { describe, expect, it } from 'vitest'

import en from './locales/en.json'
import es from './locales/es.json'
import ja from './locales/ja.json'
import ru from './locales/ru.json'
import zh from './locales/zh.json'

/**
 * Collaborators are free (SPEC.md, "What premium governs"): premium decides how
 * long recorded time is kept and nothing else. No language may still sell it
 * as the way to add workers or viewers.
 */
const LOCALES: Record<string, Record<string, string>> = { en, es, ja, ru, zh }

/**
 * How each language talks about collaboration. Stems where the language
 * inflects, so "наблюдателей" is caught as well as "наблюдатель".
 */
const COLLABORATION_WORDS: Record<string, string[]> = {
  en: ['collaborator', 'worker', 'viewer', 'team'],
  es: ['colaborador', 'trabajador', 'observador', 'equipo'],
  ja: [
    '共同作業者',
    'コラボレーター',
    'ワーカー',
    'ビューアー',
    '閲覧者',
    'チーム',
  ],
  ru: ['участник', 'исполнител', 'наблюдател', 'работник', 'командн'],
  zh: ['协作', '工作者', '查看者', '团队'],
}

describe('premium copy', () => {
  it.each(Object.keys(LOCALES))(
    '%s: has no "collaborators need Premium" message',
    (lang) => {
      expect(LOCALES[lang]).not.toHaveProperty([
        'project.createModal.collaborators.premiumRequired',
      ])
    },
  )

  it.each(Object.keys(LOCALES))(
    '%s: the premium banner sells history, not collaborators',
    (lang) => {
      const description =
        LOCALES[lang]['dashboard.premiumBanner.description'].toLowerCase()

      expect(description).toContain('{{days}}')

      for (const word of COLLABORATION_WORDS[lang]) {
        expect(description, word).not.toContain(word.toLowerCase())
      }
    },
  )
})
