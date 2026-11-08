import { Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import {
  LuArrowUpRight,
  LuAtSign,
  LuBriefcaseBusiness,
  LuCamera,
  LuMail,
  LuPlay,
  LuSend,
  LuUsers,
  LuWallet,
} from 'react-icons/lu'
import { NavLink } from 'react-router-dom'
import styled from 'styled-components'

import {
  $profile,
  $profileLoading,
  SOCIAL_LINKS,
  type SocialLinkField,
} from '../../model'

import { ProfileViewInfoRow } from './profile-view-info-row'
import {
  ProfileViewSection,
  ProfileViewSectionHead,
} from './profile-view-section'

import type { ReactNode } from 'react'
import type { IconType } from 'react-icons'

import { routes } from '@/routes'
import { formatAddress } from '@/shared'

/** Rows the skeleton holds while the profile loads. */
const SKELETON_ROWS = 4

const SOCIAL_LINK_VIEW_CONFIG: Record<
  SocialLinkField,
  {
    icon: IconType
    altKey: string
    prefixKey: string
    route: { build: (params: { userId: string }) => string }
  }
> = {
  linkedIn: {
    icon: LuBriefcaseBusiness,
    altKey: 'profile.links.linkedin',
    prefixKey: 'profile.view.social.linkedinPrefix',
    route: routes.linkedin,
  },
  facebook: {
    icon: LuUsers,
    altKey: 'profile.links.facebook',
    prefixKey: 'profile.view.social.facebookPrefix',
    route: routes.facebook,
  },
  telegram: {
    icon: LuSend,
    altKey: 'profile.links.telegram',
    prefixKey: 'profile.view.social.telegramPrefix',
    route: routes.telegram,
  },
  twitter: {
    icon: LuAtSign,
    altKey: 'profile.links.twitter',
    prefixKey: 'profile.view.social.twitterPrefix',
    route: routes.twitter,
  },
  instagram: {
    icon: LuCamera,
    altKey: 'profile.links.instagram',
    prefixKey: 'profile.view.social.instagramPrefix',
    route: routes.instagram,
  },
  youtube: {
    icon: LuPlay,
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
      icon: <LuMail aria-hidden />,
      label: t('profile.view.email'),
      value: user.email,
    },
    user?.connectedWallet && {
      key: 'wallet',
      icon: <LuWallet aria-hidden />,
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
      <ProfileViewSectionHead
        title={t('profile.view.findMe')}
        icon={<LuArrowUpRight aria-hidden />}
      />
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
              icon={<config.icon aria-hidden />}
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
              trailing={<LuArrowUpRight size={16} aria-hidden />}
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
