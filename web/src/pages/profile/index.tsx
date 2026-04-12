import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'

import { ProfileView } from '@/features/profile'

export default function ProfilePage() {
  const { t, i18n } = useTranslation()

  return (
    <>
      <Helmet
        htmlAttributes={{ lang: i18n.language }}
        title={t('profile.title')}
      />
      <ProfileView />
    </>
  )
}
