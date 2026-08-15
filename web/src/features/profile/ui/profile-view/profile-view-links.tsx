import { Pencil1Icon, CopyIcon, Share1Icon } from '@radix-ui/react-icons'
import { Flex, Grid, Skeleton, type FlexProps } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink } from 'react-router-dom'
import styled from 'styled-components'

import {
  $profile,
  $isAuthenticatedUserProfile,
  $profileLoading,
  SOCIAL_LINKS,
  type SocialLinkField,
} from '../../model'

import { ProfileViewInfoRow } from './profile-view-info-row'
import { ProfileViewCard } from './profile-view-styles'

import { routes } from '@/routes'
import {
  Button,
  CaseIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  PersonIcon,
  TelegramIcon,
  Text,
  TwitterIcon,
  YoutubeIcon,
  formatWalletAddress,
  getCountryLabel,
  useBreakpoint,
} from '@/shared'

type ProfileViewLinksProps = {
  gridArea?: string
  onWalletAddressCopy?: () => void
  onShareProfile?: () => void
}

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

export const ProfileViewLinks = ({
  gridArea,
  onWalletAddressCopy,
  onShareProfile,
}: ProfileViewLinksProps) => {
  const isDesktop = useBreakpoint('isDesktop')
  const { t } = useTranslation()

  const { user, isAuthenticatedUserProfile, profileLoading } = useUnit({
    user: $profile,
    isAuthenticatedUserProfile: $isAuthenticatedUserProfile,
    profileLoading: $profileLoading,
  })

  const walletAddress = formatWalletAddress(
    user?.friendlyWalletAddress || 'efgH1234567890',
  )

  const infoRowGap: FlexProps['gap'] = {
    initial: '0',
  }

  return (
    <Root $gridArea={gridArea} shadow={false}>
      <Flex
        gap={{ initial: '4', md: '5' }}
        direction={'column'}
        style={{ height: '100%' }}
      >
        <Flex justify={'between'} gap={'5'} align={'center'}>
          {isDesktop ? (
            <>
              <Flex direction={'column'} gap={'2'}>
                <Skeleton loading={profileLoading}>
                  <Text size={'7'} weight={'medium'}>
                    {user?.name || user?.title || t('profile.view.mockName')}
                  </Text>
                </Skeleton>
                <Flex gap={'2'} align={'center'}>
                  <Button
                    variant="ghost"
                    color="neutral"
                    onClick={onWalletAddressCopy}
                  >
                    <Skeleton loading={profileLoading}>
                      <Text
                        $themeVariant={'primary'}
                        size={'3'}
                        weight={'medium'}
                      >
                        {walletAddress}
                      </Text>
                    </Skeleton>
                    <CopyIcon />
                  </Button>
                </Flex>
              </Flex>
              <Flex gap={'2'} align={'center'}>
                <Button
                  variant="outline"
                  color="neutral"
                  size="l"
                  onClick={onShareProfile}
                >
                  {t('common.share')}
                  <Share1Icon />
                </Button>
                {isAuthenticatedUserProfile && (
                  <Link
                    to={routes.profile.children.edit.build({
                      walletAddress: user?.friendlyWalletAddress || '',
                    })}
                    viewTransition
                  >
                    <Button size="l">
                      {t('common.edit')}
                      <Pencil1Icon />
                    </Button>
                  </Link>
                )}
              </Flex>
            </>
          ) : (
            <div />
          )}
        </Flex>
        <Flex direction={'column'} gap={{ initial: '3', md: '4' }}>
          {user?.company && (
            <ProfileViewInfoRow
              hoverEffects={false}
              icon={<img src={CaseIcon} alt={t('profile.view.alt.case')} />}
              text={
                <Flex gap={{ initial: '5px', md: '6px' }}>
                  <Text color={'gray'}>{t('profile.view.worksAt')}</Text>
                  <Text weight={'medium'}>
                    {user?.company ?? t('profile.view.mockCompany')}
                  </Text>
                </Flex>
              }
            />
          )}
          {(user?.city || user?.country) && (
            <ProfileViewInfoRow
              hoverEffects={false}
              icon={<img src={PersonIcon} alt={t('profile.view.location')} />}
              text={
                <Flex gap={{ initial: '5px', md: '6px' }}>
                  <Text color={'gray'}>{t('profile.view.location')}</Text>
                  <Text weight={'medium'}>
                    {[user.city, getCountryLabel(user.country)]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                </Flex>
              }
            />
          )}
          <Grid
            columns={{ initial: '1', md: '2' }}
            gap={{ initial: '3', md: '4' }}
          >
            {SOCIAL_LINKS.map(({ name }) => {
              const value = user?.[name]

              if (!value) {
                return null
              }

              const config = SOCIAL_LINK_VIEW_CONFIG[name]

              return (
                <ProfileViewInfoRow
                  key={name}
                  icon={<img src={config.icon} alt={t(config.altKey)} />}
                  text={
                    <NavLink
                      to={config.route.build({ userId: value })}
                      target="_blank"
                    >
                      <Flex gap={infoRowGap}>
                        <Text color={'gray'}>{t(config.prefixKey)}</Text>
                        <Text weight={'medium'}>{value}</Text>
                      </Flex>
                    </NavLink>
                  }
                />
              )
            })}
          </Grid>
        </Flex>
      </Flex>
    </Root>
  )
}

const Root = styled(ProfileViewCard)`
  box-shadow: var(--shadow-4);

  ${(p) => p.theme.breakpoints.up('md')} {
    padding-inline: var(--space-4);
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    border-top: none;
    padding-top: 0;
    border-top-right-radius: 0;
    border-top-left-radius: 0;
  }
`
