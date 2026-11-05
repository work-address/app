import { Badge } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'

/** Marks the way in this browser used last: the two are separate accounts. */
export const AuthLastUsed = () => {
  const { t } = useTranslation()

  return (
    <Badge size="1" variant="soft">
      {t('signIn.lastUsed')}
    </Badge>
  )
}
