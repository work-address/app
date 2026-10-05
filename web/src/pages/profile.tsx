import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router-dom'

import { ProfileView, ProfileGate } from '@/features/profile'
import { routes } from '@/routes'
import { PageHelmet } from '@/shared'

export default function ProfilePage() {
  const { t } = useTranslation()

  const { walletAddress } = useParams<{ walletAddress: string }>()

  if (!walletAddress) {
    return <Navigate to={routes.signIn.build()} />
  }

  return (
    <>
      <ProfileGate friendlyWalletAddress={walletAddress} />
      <PageHelmet title={t('profile.title')} />
      <ProfileView />
    </>
  )
}
