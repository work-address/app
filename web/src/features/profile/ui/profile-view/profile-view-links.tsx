import { EnvelopeClosedIcon, TokensIcon } from '@radix-ui/react-icons'
import { Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import styled from 'styled-components'

import {
  $profile,
  $profileLoading,
  SOCIAL_LINKS,
  type SocialLinkField,
} from '../../model'

import { ProfileViewInfoRow } from './profile-view-info-row'
import { ProfileViewSection } from './profile-view-section'

import type { ReactNode } from 'react'

import { routes } from '@/routes'
import {
  CaseIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  PersonIcon,
  TelegramIcon,
  Text,
  TwitterIcon,
  YoutubeIcon,
  formatAddress,
  getCountryLabel,
} from '@/shared'

/** Rows the skeleton holds while the profile loads. */
const SKELETON_ROWS = 4

const SOCIAL_LINK_VIEW_CONFIG: Record<
  SocialLinkField,
  {
    icon: string
    altKey: string
    prefixKey: string
    route: { build: (params: { userId: string }) => string }
  }
> = {
  linkedIn: {
    icon: LinkedinIcon,
    altKey: 'profile.links.linkedin',
    prefixKey: 'profile.view.social.linkedinPrefix',
    route: routes.linkedin,
  },
  facebook: {
    icon: FacebookIcon,
    altKey: 'profile.links.facebook',
    prefixKey: 'profile.view.social.facebookPrefix',
    route: routes.facebook,
  },
  telegram: {
    icon: TelegramIcon,
    altKey: 'profile.links.telegram',
    prefixKey: 'profile.view.social.telegramPrefix',
    route: routes.telegram,
  },
  twitter: {
    icon: TwitterIcon,
    altKey: 'profile.links.twitter',
    prefixKey: 'profile.view.social.twitterPrefix',
    route: routes.twitter,
  },
  instagram: {
    icon: InstagramIcon,
    altKey: 'profile.links.instagram',
    prefixKey: 'profile.view.social.instagramPrefix',
    route: routes.instagram,
  },
  youtube: {
    icon: YoutubeIcon,
    altKey: 'profile.links.youtube',
    prefixKey: 'profile.view.social.youtubePrefix',
    route: routes.youtube,
  },
}

/** Where this person works and lives, and where else to find them. */
export const ProfileViewLinks = () => {
  const { t, i18n } = useTranslation()

  const { user, loading } = useUnit({
    user: $profile,
    loading: $profileLoading,
  })

  if (loading) {
    return (
      <ProfileViewSection>
        <Rows>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} width="220px" height="24px" />
          ))}
        </Rows>
      </ProfileViewSection>
    )
  }

  const location = [
    user?.city,
    getCountryLabel(user?.country, i18n.resolvedLanguage ?? i18n.language),
  ]
    .filter(Boolean)
    .join(', ')

  const facts = [
    user?.company && {
      key: 'company',
      icon: <img src={CaseIcon} alt="" />,
      label: t('profile.view.worksAt'),
      value: user.company,
    },
    user?.email && {
      key: 'email',
      icon: <EnvelopeClosedIcon aria-hidden />,
      label: t('profile.view.email'),
      value: user.email,
    },
    user?.connectedWallet && {
      key: 'wallet',
      icon: <TokensIcon aria-hidden />,
      label: t('profile.view.connectedWallet'),
      value: formatAddress(user.connectedWallet),
    },
    location && {
      key: 'location',
      icon: <img src={PersonIcon} alt="" />,
      label: t('profile.view.location'),
      value: location,
    },
  ].filter((fact) => Boolean(fact)) as {
    key: string
    icon: ReactNode
    label: string
    value: string
  }[]

  const socials = SOCIAL_LINKS.filter(({ name }) => Boolean(user?.[name]))

  // With nothing to list the band would be a hairline around nothing.
  if (facts.length === 0 && socials.length === 0) {
    return null
  }

  return (
    <ProfileViewSection>
      <Rows>
        {facts.map(({ key, icon, label, value }) => (
          <ProfileViewInfoRow
            key={key}
            hoverEffects={false}
            icon={icon}
            text={
              <>
                <InlineText color="gray">{label}</InlineText>{' '}
                <InlineText weight="medium">{value}</InlineText>
              </>
            }
          />
        ))}
        {socials.map(({ name }) => {
          const value = user?.[name] as string
          const config = SOCIAL_LINK_VIEW_CONFIG[name]

          return (
            <ProfileViewInfoRow
              key={name}
              icon={<img src={config.icon} alt={t(config.altKey)} />}
              text={
                <NavLink
                  to={config.route.build({ userId: value })}
                  target="_blank"
                  rel="noreferrer"
                >
                  <InlineText color="gray">{t(config.prefixKey)}</InlineText>
                  <InlineText weight="medium">{value}</InlineText>
                </NavLink>
              }
            />
          )
        })}
      </Rows>
    </ProfileViewSection>
  )
}

/* Text is inline-block here, which would drop a long value onto a line of its
   own as one block; inline, it follows its label and wraps like a sentence.
   Doubled to outrank that rule. */
const InlineText = styled(Text)`
  && {
    display: inline;
  }
`

/* Every fact and link on one two-column grid, so a row never leaves half the
   card empty. */
const Rows = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ui-space-3) var(--ui-space-5);

  @container (max-width: 640px) {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--ui-space-2);
  }
`
