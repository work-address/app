import { Grid, Skeleton, Text } from '@radix-ui/themes'
import {
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  containsHost,
  normalizeLink,
  SOCIAL_DOMAIN_BY_FIELD,
  SOCIAL_LINKS,
  type SocialLinkField,
} from '../../model'

import { ProfileEditActions } from './profile-edit-actions'
import {
  INPUT_LABEL_WIDTH,
  type ProfileEditFormState,
} from './profile-edit-field'

import type { ClipboardEvent } from 'react'

import { Card, Input, showToast, type CardProps } from '@/shared'

type Props = {
  isDesktop: boolean
  profileLoading: boolean
  isDirty: boolean
  profileSaving: boolean
  onReset: () => void
  register: UseFormRegister<ProfileEditFormState>
  errors: FieldErrors<ProfileEditFormState>
  setValue: UseFormSetValue<ProfileEditFormState>
}

export const ProfileEditLinks = ({
  isDesktop,
  profileLoading,
  isDirty,
  profileSaving,
  onReset,
  register,
  errors,
  setValue,
}: Props) => {
  const { t } = useTranslation()

  const handleSocialPaste = (
    type: SocialLinkField,
    e: ClipboardEvent<HTMLInputElement>,
  ) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    const domain = SOCIAL_DOMAIN_BY_FIELD[type]

    const isXDomain = type === 'twitter' && containsHost(text, 'x.com')
    const randomLinkPasted = text.includes('http')
    const allowedDomain = containsHost(text, domain) || isXDomain
    const notAllowedTextPasted = !allowedDomain

    if (notAllowedTextPasted && randomLinkPasted) {
      showToast('error', {
        message: 'Invalid link',
        position: isDesktop ? 'top-center' : 'bottom-center',
      })

      return
    }

    const prefix = isXDomain ? 'x.com' : domain
    const normalized = normalizeLink(prefix, text)
    setValue(type, normalized, { shouldDirty: true, shouldValidate: true })
  }

  return (
    <Root>
      <Text
        size={isDesktop ? '6' : '4'}
        weight={'medium'}
        mb={{ initial: '3', md: '5' }}
      >
        {t('profile.links.title')}
      </Text>
      <Grid gap={{ initial: '4', md: '5' }}>
        {SOCIAL_LINKS.map(({ name, labelKey, domain }) => (
          <Skeleton key={name} loading={profileLoading}>
            <LinkInput
              label={t(labelKey)}
              addonLeft={`${domain}/`}
              labelWidth={INPUT_LABEL_WIDTH}
              disabled={profileSaving}
              onPaste={(e) => handleSocialPaste(name, e)}
              state={errors[name] ? 'error' : undefined}
              {...register(name)}
            />
          </Skeleton>
        ))}
        {!isDesktop && (
          <BottomSheet columns={'1fr 1fr'} gap={'var(--space-4)'}>
            <ProfileEditActions
              isDirty={isDirty}
              profileSaving={profileSaving}
              onReset={onReset}
              stretch
            />
          </BottomSheet>
        )}
      </Grid>
    </Root>
  )
}

const Root = styled(Card)<CardProps>`
  box-shadow: none;

  /* Edge to edge on a phone, so the card is the page and a shadow under it
     reads as a stray band. The attribute selector is what Card's own shadow
     rule uses, so this is what it takes to outrank it. The rule on top is
     then the only thing separating this section from the account form above -
     without it the two run together as one undivided list of fields. */
  ${(p) => p.theme.breakpoints.down('md')} {
    border: none;
    border-top: 1px solid var(--ds-neutral-alpha-6);

    &[data-shadow] {
      box-shadow: none;
    }
  }
`

const BottomSheet = styled(Grid)`
  position: fixed;
  /* Clears the home indicator on phones without a hardware button. */
  padding: var(--space-2) var(--space-5)
    calc(14px + env(safe-area-inset-bottom, 0px));
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--white);
  border-top: 1px solid var(--ds-neutral-alpha-6);
`

const LinkInput = styled(Input)`
  [data-side='left'] {
    padding-right: 0;
  }
`
