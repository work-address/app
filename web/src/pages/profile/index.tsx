import { useUnit } from 'effector-react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router-dom'

import { $user } from '@/entities/profile'
import { ProfileView, ProfileGate } from '@/features/profile'

export default function ProfilePage() {
  const { t, i18n } = useTranslation()
  const user = useUnit($user)

  const { walletAddress } = useParams<{ walletAddress: string }>()

  if (!user) {
    return null
  }

  if (!walletAddress) {
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
