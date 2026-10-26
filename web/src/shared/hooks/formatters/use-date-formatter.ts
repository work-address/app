import { format } from 'date-fns'
import { enUS, es, ja, ru, zhCN } from 'date-fns/locale'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { formatDateRange } from '../../lib'

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

  return useMemo(() => {
    const locale = dateFnsLocaleFor(i18n.language)
    const withPattern = (date: Date, pattern: string) =>
      format(date, pattern, { locale })

    return {
      format: (date: Date) => withPattern(date, 'do MMM yyyy'),
      /** Two dates as one phrase, e.g. `12th – 18th Oct 2026`. */
      formatRange: (from: Date, to: Date) =>
        formatDateRange(from, to, withPattern),
    }
  }, [i18n.language])
}
