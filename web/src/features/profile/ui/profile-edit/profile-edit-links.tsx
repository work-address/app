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

import { type ProfileEditFormState } from './profile-edit-field'
import { SectionHeading } from './profile-edit-styles'

import type { ClipboardEvent } from 'react'

import { Input, showToast, WorkspaceSheet } from '@/shared'

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
              columns="1fr"
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

const Root = styled(WorkspaceSheet)`
  display: grid;
  gap: var(--ui-section-gap);

  ${(p) => p.theme.breakpoints.down('md')} {
    gap: var(--ui-space-3);
  }
`

/* Two columns of links on a wide screen; each is short. */
const Links = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--ui-space-4) var(--ui-space-6);

  ${(p) => p.theme.breakpoints.up('lg')} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--ui-space-5) var(--ui-space-6);
  }
`

const LinkInput = styled(Input)`
  [data-side='left'] {
    padding-right: 0;
  }
`
