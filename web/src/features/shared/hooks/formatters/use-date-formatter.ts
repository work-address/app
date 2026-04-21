import { useTranslation } from 'react-i18next'

export const useDateFormatter = () => {
  const { i18n } = useTranslation()

  return new Intl.DateTimeFormat(i18n.language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  })
}
