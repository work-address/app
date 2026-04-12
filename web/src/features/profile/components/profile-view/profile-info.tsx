import { Share1Icon, Pencil1Icon, CopyIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import styled from 'styled-components'

import { InfoRow } from '../info-row'

import { ProfileViewCard } from './styled'

import {
  Button,
  routes,
  showInfoToast,
  Text,
  useBreakpoints,
} from '@/features/shared'

type ProfileInfoProps = {
  gridArea?: string
}

export const ProfileInfo = ({ gridArea }: ProfileInfoProps) => {
  const { t } = useTranslation()
  const { breakpoints } = useTheme()
  const isUpMd = useMediaQuery(breakpoints.up('md'))

  return (
    <StyledCard gridArea={gridArea} shadow={false}>
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
                  {t('profile.view.mockName')}
                </Text>

                <Flex gap={'2'} align={'center'}>
                  <Button variant={'ghost'} onClick={handleCopyWalletAddress}>
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

              <Flex gap={'2'}>
                <Button variant={'outline'} color={'gray'} size={'3'}>
                  {t('common.share')}
                  <Share1Icon />
                </Button>

                <Link to={routes.profile.children.edit.schema}>
                  <Button themeVariant={'primary'} size={'3'}>
                    {t('common.edit')}
                    <Pencil1Icon />
                  </Button>
                </Link>
              </Flex>
            </>
          ) : (
            <div />
          )}
        </Flex>

        <Flex direction={'column'} gap={{ initial: '3', md: '4' }}>
          <InfoRow
            icon={
              <img
                src={'/img/icons/case.svg'}
                alt={t('profile.view.alt.case')}
              />
            }
            text={
              <Text>
                <Text color={'gray'}>{t('profile.view.worksAt')}</Text>{' '}
                {t('profile.view.mockCompany')}
              </Text>
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
              <Text>
                <Text color={'gray'}>
                  {t('profile.view.social.linkedinPrefix')}
                </Text>
                johndoe
              </Text>
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
              <Text>
                <Text color={'gray'}>
                  {t('profile.view.social.facebookPrefix')}
                </Text>
                johndoe
              </Text>
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
              <Text>
                <Text color={'gray'}>
                  {t('profile.view.social.telegramPrefix')}
                </Text>
                johndoe
              </Text>
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
