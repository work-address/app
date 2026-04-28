import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'

import { EditProfile } from '@/features/profile'

export default function FreelancerProfilePage() {
  const { t, i18n } = useTranslation()

  return (
    <>
      <Helmet
        htmlAttributes={{ lang: i18n.language }}
        title={t('app.documentTitle.profileEdit')}
      />

      <EditProfile />
    </>
  )
}
