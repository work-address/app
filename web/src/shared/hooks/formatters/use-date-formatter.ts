import { format } from 'date-fns'
import { enUS, es, ja, ru, zhCN } from 'date-fns/locale'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

const dateFnsLocales = {
  en: enUS,
  ru,
  es,
  ja,
  zh: zhCN,
} as const

function dateFnsLocaleFor(language: string | undefined) {
  const code = language?.split('-')[0]?.toLowerCase() ?? 'en'

  return dateFnsLocales[code as keyof typeof dateFnsLocales] ?? enUS
}

export const useDateFormatter = () => {
  const { i18n } = useTranslation()

  return useMemo(
    () => ({
      format: (date: Date) =>
        format(date, 'do MMM yyyy', {
          locale: dateFnsLocaleFor(i18n.language),
        }),
    }),
    [i18n.language],
  )
}
