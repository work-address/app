import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router-dom'

import { ProfileView, ProfileGate } from '@/features/profile'

export default function ProfilePage() {
  const { t, i18n } = useTranslation()
  const { id } = useParams<{ id: string }>()

  if (!id) {
    return <Navigate to="/" />
  }

  return (
    <>
      <ProfileGate userId={id} />

      <Helmet
        htmlAttributes={{ lang: i18n.language }}
        title={t('profile.title')}
      />

      <ProfileView />
    </>
  )
}
