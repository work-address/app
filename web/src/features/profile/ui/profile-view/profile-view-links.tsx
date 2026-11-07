import {
  ArrowTopRightIcon,
  EnvelopeClosedIcon,
  TokensIcon,
} from '@radix-ui/react-icons'
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
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  SectionTitle,
  TelegramIcon,
  TwitterIcon,
  YoutubeIcon,
  formatAddress,
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

/** Where else to find this person: contact facts and social profiles. */
export const ProfileViewLinks = () => {
  const { t } = useTranslation()

  const { user, loading } = useUnit({
    user: $profile,
    loading: $profileLoading,
  })

  if (loading) {
    return (
      <ProfileViewSection>
        <Skeleton width="160px" height="30px" />
        <Rows>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} width="220px" height="40px" />
          ))}
        </Rows>
      </ProfileViewSection>
    )
  }

  // Company and location head the identity sheet; this lists the ways to
  // reach the person.
  const facts = [
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
  ].filter((fact) => Boolean(fact)) as {
    key: string
    icon: ReactNode
    label: string
    value: string
  }[]

  const socials = SOCIAL_LINKS.filter(({ name }) => Boolean(user?.[name]))

  // With nothing to list the panel would be a frame around nothing.
  if (facts.length === 0 && socials.length === 0) {
    return null
  }

  return (
    <ProfileViewSection>
      <SectionTitle>{t('profile.view.findMe')}</SectionTitle>
      <Rows>
        {facts.map(({ key, icon, label, value }) => (
          <ProfileViewInfoRow
            key={key}
            icon={icon}
            label={label}
            value={value}
          />
        ))}
        {socials.map(({ name }) => {
          const value = user?.[name] as string
          const config = SOCIAL_LINK_VIEW_CONFIG[name]

          return (
            <ProfileViewInfoRow
              key={name}
              icon={<img src={config.icon} alt="" />}
              label={t(config.altKey)}
              value={
                <NavLink
                  to={config.route.build({ userId: value })}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t(config.prefixKey)}
                  {value}
                </NavLink>
              }
              trailing={<ArrowTopRightIcon aria-hidden />}
            />
          )
        })}
      </Rows>
    </ProfileViewSection>
  )
}

/* One column of rows parted by hairlines. */
const Rows = styled.div`
  display: grid;
`
