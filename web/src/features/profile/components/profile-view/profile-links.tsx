import { Pencil1Icon, CopyIcon } from '@radix-ui/react-icons'
import { Flex, type FlexProps } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink } from 'react-router-dom'
import styled from 'styled-components'

import { $profile, $isAuthenticatedUserProfile } from '../../model'
import { InfoRow } from '../info-row'

import { ProfileViewCard } from './styled'

import { routes } from '@/routes'
import { Button, Text, useBreakpoint, formatWalletAddress } from '@/shared'

type ProfileLinksProps = {
  gridArea?: string
  onWalletAddressCopy?: () => void
  onShareProfile?: () => void
}

export const ProfileLinks = ({
  gridArea,
  onWalletAddressCopy,
}: ProfileLinksProps) => {
  const isDesktop = useBreakpoint('isDesktop')
  const { t } = useTranslation()

  const { user, isAuthenticatedUserProfile } = useUnit({
    user: $profile,
    isAuthenticatedUserProfile: $isAuthenticatedUserProfile,
  })

  const walletAddress = formatWalletAddress(user?.friendlyWalletAddress || '')

  const infoRowGap: FlexProps['gap'] = {
    initial: '0',
  }

  return (
    <StyledCard $gridArea={gridArea} shadow={false}>
      <Flex
        gap={{ initial: '4', md: '5' }}
        direction={'column'}
        justify={'between'}
        style={{ height: '100%' }}
      >
        <Flex justify={'between'} gap={'5'} align={'center'}>
          {isDesktop ? (
            <>
              <Flex direction={'column'} gap={'2'}>
                <Text size={'7'} weight={'medium'}>
                  {user?.userName || t('profile.view.mockName')}
                </Text>

                <Flex gap={'2'} align={'center'}>
                  <Button variant={'ghost'} onClick={onWalletAddressCopy}>
                    <Text
                      $themeVariant={'primary'}
                      size={'3'}
                      weight={'medium'}
                    >
                      {walletAddress}
                    </Text>

                    <CopyIcon />
                  </Button>
                </Flex>
              </Flex>

              {isAuthenticatedUserProfile && (
                <Link
                  to={routes.profile.children.edit.build({
                    walletAddress: user?.friendlyWalletAddress || '',
                  })}
                >
                  <Button themeVariant={'primary'} size={'3'}>
                    {t('common.edit')}
                    <Pencil1Icon />
                  </Button>
                </Link>
              )}
            </>
          ) : (
            <div />
          )}
        </Flex>

        <Flex direction={'column'} gap={{ initial: '3', md: '4' }}>
          <InfoRow
            hoverEffects={false}
            icon={
              <img
                src={'/img/icons/case.svg'}
                alt={t('profile.view.alt.case')}
              />
            }
            text={
              <Flex gap={{ initial: '5px', md: '6px' }}>
                <Text color={'gray'}>{t('profile.view.worksAt')}</Text>

                <Text weight={'medium'}>
                  {user?.company ?? t('profile.view.mockCompany')}
                </Text>
              </Flex>
            }
          />
          <InfoRow
            icon={
              <img
                src={'/img/icons/linkedin.svg'}
                alt={t('profile.links.linkedin')}
              />
            }
            text={
              <NavLink
                to={routes.linkedin.build({
                  userId: user?.linkedIn || 'johndoe',
                })}
                target="_blank"
              >
                <Flex gap={infoRowGap}>
                  <Text color={'gray'}>
                    {t('profile.view.social.linkedinPrefix')}
                  </Text>
                  <Text weight={'medium'}>{user?.linkedIn ?? 'johndoe'}</Text>
                </Flex>
              </NavLink>
            }
          />
          <InfoRow
            icon={
              <img
                src={'/img/icons/facebook.svg'}
                alt={t('profile.links.facebook')}
              />
            }
            text={
              <NavLink
                to={routes.facebook.build({
                  userId: user?.facebook || 'johndoe',
                })}
                target="_blank"
              >
                <Flex gap={infoRowGap}>
                  <Text color={'gray'}>
                    {t('profile.view.social.facebookPrefix')}
                  </Text>
                  <Text weight={'medium'}>{user?.facebook ?? 'johndoe'}</Text>
                </Flex>
              </NavLink>
            }
          />
          <InfoRow
            icon={
              <img
                src={'/img/icons/telegram.svg'}
                alt={t('profile.links.telegram')}
              />
            }
            text={
              <NavLink
                to={routes.telegram.build({
                  userId: user?.telegram || 'johndoe',
                })}
                target="_blank"
              >
                <Flex gap={infoRowGap}>
                  <Text color={'gray'}>
                    {t('profile.view.social.telegramPrefix')}
                  </Text>
                  <Text weight={'medium'}>{user?.telegram ?? 'johndoe'}</Text>
                </Flex>
              </NavLink>
            }
          />
        </Flex>
      </Flex>
    </StyledCard>
  )
}

const StyledCard = styled(ProfileViewCard)`
  ${(p) => p.theme.breakpoints.up('md')} {
    padding-bottom: var(--space-6);
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    border-top: none;
    padding-top: 0;
    border-top-right-radius: 0;
    border-top-left-radius: 0;
  }
`
