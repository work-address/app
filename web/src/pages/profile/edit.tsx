import { useUnit } from 'effector-react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { useParams, Navigate } from 'react-router-dom'

import { $user } from '@/entities/profile'
import { EditProfile, ProfileGate } from '@/features/profile'
import { routes } from '@/routes'

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

      <Helmet
        htmlAttributes={{ lang: i18n.language }}
        title={t('app.documentTitle.profileEdit')}
      />

      <EditProfile />
    </>
  )
}
