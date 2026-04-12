import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import es from './locales/es.json'
import ja from './locales/ja.json'
import ru from './locales/ru.json'
import zh from './locales/zh.json'

const supportedLanguages = ['en', 'ru', 'zh', 'ja', 'es'] as const

function getInitialLanguage(): string {
  if (typeof navigator === 'undefined') {
    return 'en'
  }
  const lang = navigator.language.toLowerCase()
  if (lang.startsWith('zh')) {
    return 'zh'
  }
  if (lang.startsWith('ja')) {
    return 'ja'
  }
  if (lang.startsWith('es')) {
    return 'es'
  }
  if (lang.startsWith('ru')) {
    return 'ru'
  }
  return 'ja'
}

void i18n.use(initReactI18next).init({
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  supportedLngs: [...supportedLanguages],
  interpolation: { escapeValue: false },
  resources: {
    en: {
      translation: en,
    },
    ru: {
      translation: ru,
    },
    zh: {
      translation: zh,
    },
    ja: {
      translation: ja,
    },
    es: {
      translation: es,
    },
  },
})

export { default } from 'i18next'
