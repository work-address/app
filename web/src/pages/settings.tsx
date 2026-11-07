import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'

import { $user } from '@/entities/profile'
import { ProfileEdit, ProfileGate } from '@/features/profile'
import { PageHelmet, RouteSkeleton } from '@/shared'

/**
 * The signed-in user's settings: their profile editor, reached from the
 * navigation without an id in the URL. `/profile/:id/edit` stays the same form.
 */
export default function SettingsPage() {
  const { t } = useTranslation()
  const user = useUnit($user)

  // The signed-in user is still loading; a blank sheet would read as broken.
  if (!user?.id) {
    return <RouteSkeleton variant="document" />
  }

  return (
    <>
      <ProfileGate id={user.id} />
      <PageHelmet
        title={t('settings.page.title')}
        description={t('profile.form.edit.description')}
      />
      <ProfileEdit variant="settings" />
    </>
  )
}
