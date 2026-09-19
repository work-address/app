import { Skeleton } from '@radix-ui/themes'
import { Controller, type Control } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { PROFILE_VISIBILITY_HINT_KEY, profileVisibility } from '../../model'

import { type ProfileEditFormState } from './profile-edit-field'

import { Card, Checkbox, Text, type CardProps } from '@/shared'

const CHECKBOX_ID = 'profile-edit-visible'

type Props = {
  isDesktop: boolean
  profileLoading: boolean
  profileSaving: boolean
  control: Control<ProfileEditFormState>
}

/**
 * Hide or show the profile page. Saved with the rest of the form, and always
 * next to the reminder that it hides this site's page only: a profile
 * published on chain is withdrawn there, never by this switch.
 */
export const ProfileEditVisibility = ({
  isDesktop,
  profileLoading,
  profileSaving,
  control,
}: Props) => {
  const { t } = useTranslation()

  return (
    <Root>
      <Text size={isDesktop ? '6' : '4'} weight={'medium'}>
        {t('profile.visibility.title')}
      </Text>
      <Controller
        control={control}
        name="visible"
        render={({ field }) => {
          const state = profileVisibility(field.value)

          return (
            <Skeleton loading={profileLoading}>
              <Body data-state={state}>
                <Option>
                  <Checkbox
                    id={CHECKBOX_ID}
                    checked={state === 'public'}
                    disabled={profileSaving}
                    onCheckedChange={(checked) => {
                      field.onChange(checked === true)
                    }}
                  />
                  <Text as="label" htmlFor={CHECKBOX_ID} size={'3'}>
                    {t('profile.visibility.label')}
                  </Text>
                </Option>
                <Text size={'2'} color={'gray'} aria-live="polite">
                  {t(PROFILE_VISIBILITY_HINT_KEY[state])}
                </Text>
                <Text size={'2'} color={'gray'}>
                  {t('profile.visibility.chainNote')}
                </Text>
              </Body>
            </Skeleton>
          )
        }}
      />
    </Root>
  )
}

const Root = styled(Card)<CardProps>`
  display: grid;
  gap: var(--space-4);
  box-shadow: none;

  /* The same phone treatment as the links section above it: edge to edge,
     no shadow, and a rule on top so the two sections do not run together. */
  ${(p) => p.theme.breakpoints.down('md')} {
    border: none;
    border-top: 1px solid var(--ds-neutral-alpha-6);

    &[data-shadow] {
      box-shadow: none;
    }
  }
`

const Body = styled.div`
  display: grid;
  gap: var(--space-2);
`

const Option = styled.div`
  display: grid;
  grid-auto-flow: column;
  justify-content: start;
  align-items: center;
  gap: var(--space-2);
`
