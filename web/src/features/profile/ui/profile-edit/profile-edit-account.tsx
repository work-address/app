import { Skeleton } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SectionHeading } from './profile-edit-styles'

import type { $profile } from '../../model'

import { Input, WorkspaceSheet } from '@/shared'

type Props = {
  user: ReturnType<(typeof $profile)['getState']>
  profileLoading: boolean
}

/** The account itself: the address it signs in with, which cannot change. */
export const ProfileEditAccount = ({ user, profileLoading }: Props) => {
  const { t } = useTranslation()

  return (
    <Root>
      <SectionHeading>{t('settings.account.title')}</SectionHeading>
      <Skeleton loading={profileLoading}>
        <Input
          label={t('profile.form.address')}
          columns="1fr"
          value={user?.address || ''}
          disabled
          id={'address'}
        />
      </Skeleton>
    </Root>
  )
}

const Root = styled(WorkspaceSheet)`
  display: grid;
  gap: var(--ui-section-gap);
`
