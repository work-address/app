import { useTranslation } from 'react-i18next'

import { Button } from '@/shared'

type ProfileEditActionsProps = {
  isDirty: boolean
  profileSaving: boolean
  onReset: () => void
  stretch?: boolean
}

export const ProfileEditActions = ({
  isDirty,
  profileSaving,
  onReset,
  stretch,
}: ProfileEditActionsProps) => {
  const { t } = useTranslation()
  const disabled = !isDirty || profileSaving

  return (
    <>
      <Button
        color="neutral"
        variant="soft"
        onClick={onReset}
        disabled={disabled}
        type="button"
        stretch={stretch}
      >
        {t('profile.actions.cancel')}
      </Button>
      <Button
        disabled={disabled}
        type="submit"
        stretch={stretch}
        loading={profileSaving}
      >
        {t('profile.actions.save')}
      </Button>
    </>
  )
}
