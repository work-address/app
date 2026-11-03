import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import { useParams, Navigate } from 'react-router-dom'

import { $user } from '@/entities/profile'
import { ProfileEdit, ProfileGate } from '@/features/profile'
import { routes } from '@/routes'
import { PageHelmet } from '@/shared'

export default function ProfileEditPage() {
  const { t } = useTranslation()

  const { id } = useParams()

  const { user } = useUnit({
    user: $user,
  })

  if (!user) {
    return null
  }

  if (user.id !== id) {
    return (
      <Navigate
        to={routes.profile.build({
          id: user.id ?? '',
        })}
      />
    )
  }

  return (
    <>
      <ProfileGate id={id || ''} />
      <PageHelmet
        title={t('app.documentTitle.profileEdit')}
        description={t('profile.form.edit.description')}
      />
      <ProfileEdit />
    </>
  )
}
