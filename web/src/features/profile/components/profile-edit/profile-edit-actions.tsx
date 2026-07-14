import { useTranslation } from 'react-i18next'

import { Button, Spinner } from '@/shared'

type ProfileEditActionsProps = {
  isDirty: boolean
  profileSaving: boolean
  onReset: () => void
  stretch?: boolean
  showSpinner?: boolean
}

export const ProfileEditActions = ({
  isDirty,
  profileSaving,
  onReset,
  stretch,
  showSpinner,
}: ProfileEditActionsProps) => {
  const { t } = useTranslation()
  const disabled = !isDirty || profileSaving

  return (
    <>
      <Button
        themeVariant="secondary"
        onClick={onReset}
        disabled={disabled}
        type="button"
        stretch={stretch}
      >
        {t('profile.actions.cancel')}
      </Button>
      <Button
        themeVariant={'primary'}
        disabled={disabled}
        type={'submit'}
        stretch={stretch}
      >
        {showSpinner && profileSaving && <Spinner useCase="button" />}
        {t('profile.actions.save')}
      </Button>
    </>
  )
}
