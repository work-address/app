import { useTranslation } from 'react-i18next'

import { AuthSteps } from './auth-steps'

type Props = {
  layout?: 'column' | 'row'
  className?: string
}

const STEP_KEYS = ['signIn', 'setUp', 'track']

/** What signing in leads to: the road from here to a first invoice. */
export const AuthJourney = ({ layout, className }: Props) => {
  const { t } = useTranslation()

  return (
    <AuthSteps
      className={className}
      layout={layout}
      label={t('signIn.journey.label')}
      steps={STEP_KEYS.map((key) => ({
        title: t(`signIn.journey.${key}.title`),
        text: t(`signIn.journey.${key}.text`),
      }))}
    />
  )
}
