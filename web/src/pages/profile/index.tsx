import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router-dom'

import { $user } from '@/entities/profile'
import { ProfileView, ProfileGate } from '@/features/profile'
import { PageHelmet } from '@/shared'

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
      <ProfileGate friendlyWalletAddress={walletAddress} />
      <PageHelmet
        htmlAttributes={{ lang: i18n.language }}
        title={t('profile.title')}
      />
      <ProfileView />
    </>
  )
}
