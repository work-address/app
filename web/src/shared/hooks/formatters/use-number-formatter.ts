import { useTranslation } from 'react-i18next'

export const useNumberFormatter = () => {
  const { i18n } = useTranslation()

  return new Intl.NumberFormat(i18n.language)
}
