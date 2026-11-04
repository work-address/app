import { Skeleton } from '@radix-ui/themes'
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

import {
  INPUT_LABEL_WIDTH,
  type ProfileEditFormState,
} from './profile-edit-field'
import { SectionHeading } from './profile-edit-styles'

import type { ClipboardEvent } from 'react'

import { Card, Input, showToast, type CardProps } from '@/shared'

type Props = {
  isDesktop: boolean
  profileLoading: boolean
  profileSaving: boolean
  register: UseFormRegister<ProfileEditFormState>
  errors: FieldErrors<ProfileEditFormState>
  setValue: UseFormSetValue<ProfileEditFormState>
}

export const ProfileEditLinks = ({
  isDesktop,
  profileLoading,
  profileSaving,
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
        message: t('profile.form.errors.socialLink'),
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
      <SectionHeading>{t('profile.links.title')}</SectionHeading>
      <Links>
        {SOCIAL_LINKS.map(({ name, labelKey, domain }) => (
          <Skeleton key={name} loading={profileLoading}>
            <LinkInput
              id={name}
              label={t(labelKey)}
              addonLeft={`${domain}/`}
              labelWidth={INPUT_LABEL_WIDTH}
              disabled={profileSaving}
              onPaste={(e) => handleSocialPaste(name, e)}
              state={errors[name] ? 'error' : undefined}
              errorMessage={errors[name]?.message}
              {...register(name)}
            />
          </Skeleton>
        ))}
      </Links>
    </Root>
  )
}

const Root = styled(Card)<CardProps>`
  display: grid;
  gap: var(--space-5);

  /* Edge to edge on a phone, so the card is the page and a shadow under it
     reads as a stray band. The attribute selectors are what Card's own rules
     use, so this is what it takes to outrank them; a rounded corner would bend
     the rule on top. That rule is the only thing separating this section from
     the account form above - without it the two run together as one undivided
     list of fields. */
  ${(p) => p.theme.breakpoints.down('md')} {
    border-top: 1px solid var(--ds-neutral-alpha-6);
    padding: var(--space-5) 0 0;
    gap: var(--space-3);

    &[data-shadow] {
      box-shadow: none;
    }

    &[data-rounded] {
      border-radius: 0;
    }
  }
`

/* Two columns of links on a wide screen; each is short. */
const Links = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4) var(--space-6);

  ${(p) => p.theme.breakpoints.up('lg')} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-5) var(--space-6);
  }
`

const LinkInput = styled(Input)`
  [data-side='left'] {
    padding-right: 0;
  }
`
