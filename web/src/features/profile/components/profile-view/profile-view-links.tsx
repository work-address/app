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
} from '../../model'

import { ProfileViewInfoRow } from './profile-view-info-row'
import { ProfileViewCard } from './profile-view-styled'

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
    <StyledCard $gridArea={gridArea} shadow={false}>
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
            {user?.linkedIn && (
              <ProfileViewInfoRow
                icon={
                  <img src={LinkedinIcon} alt={t('profile.links.linkedin')} />
                }
                text={
                  <NavLink
                    to={routes.linkedin.build({
                      userId: user.linkedIn,
                    })}
                    target="_blank"
                  >
                    <Flex gap={infoRowGap}>
                      <Text color={'gray'}>
                        {t('profile.view.social.linkedinPrefix')}
                      </Text>
                      <Text weight={'medium'}>{user.linkedIn}</Text>
                    </Flex>
                  </NavLink>
                }
              />
            )}
            {user?.facebook && (
              <ProfileViewInfoRow
                icon={
                  <img src={FacebookIcon} alt={t('profile.links.facebook')} />
                }
                text={
                  <NavLink
                    to={routes.facebook.build({
                      userId: user.facebook,
                    })}
                    target="_blank"
                  >
                    <Flex gap={infoRowGap}>
                      <Text color={'gray'}>
                        {t('profile.view.social.facebookPrefix')}
                      </Text>
                      <Text weight={'medium'}>{user.facebook}</Text>
                    </Flex>
                  </NavLink>
                }
              />
            )}
            {user?.telegram && (
              <ProfileViewInfoRow
                icon={
                  <img src={TelegramIcon} alt={t('profile.links.telegram')} />
                }
                text={
                  <NavLink
                    to={routes.telegram.build({
                      userId: user.telegram,
                    })}
                    target="_blank"
                  >
                    <Flex gap={infoRowGap}>
                      <Text color={'gray'}>
                        {t('profile.view.social.telegramPrefix')}
                      </Text>
                      <Text weight={'medium'}>{user.telegram}</Text>
                    </Flex>
                  </NavLink>
                }
              />
            )}
            {user?.twitter && (
              <ProfileViewInfoRow
                icon={
                  <img src={TwitterIcon} alt={t('profile.links.twitter')} />
                }
                text={
                  <NavLink
                    to={routes.twitter.build({
                      userId: user.twitter,
                    })}
                    target="_blank"
                  >
                    <Flex gap={infoRowGap}>
                      <Text color={'gray'}>
                        {t('profile.view.social.twitterPrefix')}
                      </Text>
                      <Text weight={'medium'}>{user.twitter}</Text>
                    </Flex>
                  </NavLink>
                }
              />
            )}
            {user?.instagram && (
              <ProfileViewInfoRow
                icon={
                  <img src={InstagramIcon} alt={t('profile.links.instagram')} />
                }
                text={
                  <NavLink
                    to={routes.instagram.build({
                      userId: user.instagram,
                    })}
                    target="_blank"
                  >
                    <Flex gap={infoRowGap}>
                      <Text color={'gray'}>
                        {t('profile.view.social.instagramPrefix')}
                      </Text>
                      <Text weight={'medium'}>{user.instagram}</Text>
                    </Flex>
                  </NavLink>
                }
              />
            )}
            {user?.youtube && (
              <ProfileViewInfoRow
                icon={
                  <img src={YoutubeIcon} alt={t('profile.links.youtube')} />
                }
                text={
                  <NavLink
                    to={routes.youtube.build({
                      userId: user.youtube,
                    })}
                    target="_blank"
                  >
                    <Flex gap={infoRowGap}>
                      <Text color={'gray'}>
                        {t('profile.view.social.youtubePrefix')}
                      </Text>
                      <Text weight={'medium'}>{user.youtube}</Text>
                    </Flex>
                  </NavLink>
                }
              />
            )}
          </Grid>
        </Flex>
      </Flex>
    </StyledCard>
  )
}

const StyledCard = styled(ProfileViewCard)`
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
