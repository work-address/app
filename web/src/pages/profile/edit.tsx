import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import { useParams, Navigate } from 'react-router-dom'

import { $user } from '@/entities/profile'
import { ProfileEdit, ProfileGate } from '@/features/profile'
import { routes } from '@/routes'
import { PageHelmet } from '@/shared'

export default function FreelancerProfilePage() {
  const { t, i18n } = useTranslation()

  const { walletAddress } = useParams()

  const { user } = useUnit({
    user: $user,
  })

  if (!user) {
    return null
  }

  if (user.friendlyWalletAddress !== walletAddress) {
    return (
      <Navigate
        to={routes.profile.build({
          walletAddress: user.friendlyWalletAddress ?? '',
        })}
      />
    )
  }

  return (
    <>
      <ProfileGate friendlyWalletAddress={walletAddress || ''} />
      <PageHelmet
        htmlAttributes={{ lang: i18n.language }}
        title={t('app.documentTitle.profileEdit')}
      />
      <ProfileEdit />
    </>
  )
}
