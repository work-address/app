import { CopyIcon, Pencil1Icon, Share1Icon } from '@radix-ui/react-icons'
import { Flex, Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import styled from 'styled-components'

import { $profile, $isAuthenticatedUserProfile } from '../model'

import { ProfileViewCard } from './profile-view-styles'

import { $pending } from '@/entities/profile'
import { routes } from '@/routes'
import {
  Text,
  useBreakpoint,
  Button,
  Modal,
  formatWalletAddress,
} from '@/shared'

type ProfileViewQrCodeProps = {
  gridArea?: string
  padding?: string
  onWalletAddressCopy?: () => void
  onShareProfile?: () => void
}

export const ProfileViewQrCode = ({
  gridArea,
  onWalletAddressCopy,
  onShareProfile,
}: ProfileViewQrCodeProps) => {
  const isMobile = useBreakpoint('isMobile')
  const isDesktop = useBreakpoint('isDesktop')

  const { t } = useTranslation()

  const { user, isAuthenticatedUserProfile, profileLoading } = useUnit({
    user: $profile,
    isAuthenticatedUserProfile: $isAuthenticatedUserProfile,
    profileLoading: $pending,
  })

  const [qrModalOpened, setQrModalOpened] = useState(false)
  const qrCodeSize = isMobile ? 140 : 180

  return (
    <>
      <StyledCard $gridArea={gridArea} shadow={false}>
        <Flex
          direction={'column'}
          gap={{ initial: '4' }}
          align={'center'}
          style={{ height: '100%' }}
        >
          {isMobile && (
            <Flex direction={'column'} align={'center'} gap={{ initial: '2' }}>
              <Skeleton loading={profileLoading}>
                <Text size={'6'} weight={'medium'}>
                  {user?.name ?? user?.title ?? t('profile.view.mockName')}
                </Text>
              </Skeleton>
              <Flex gap={'2'} align={'center'}>
                <Skeleton loading={profileLoading}>
                  <Button
                    variant="ghost"
                    color="neutral"
                    onClick={onWalletAddressCopy}
                  >
                    <Text
                      $themeVariant={'primary'}
                      size={'2'}
                      weight={'medium'}
                    >
                      {user?.friendlyWalletAddress
                        ? formatWalletAddress(user?.friendlyWalletAddress)
                        : '...'}
                    </Text>
                    <CopyIcon />
                  </Button>
                </Skeleton>
              </Flex>
            </Flex>
          )}
          <QrCodeWrapper
            $size={qrCodeSize}
            onClick={() => setQrModalOpened(true)}
          >
            <Skeleton loading={profileLoading}>
              <QRCodeSVG
                value={user?.friendlyWalletAddress || ''}
                size={qrCodeSize}
                level="M"
                fgColor="var(--ds-accent-11)"
                bgColor="transparent"
                marginSize={1}
              />
            </Skeleton>
          </QrCodeWrapper>
          {isMobile && (
            <Flex gap={'2'} direction={'column'} width={'100%'}>
              {isAuthenticatedUserProfile && (
                <Link
                  to={routes.profile.children.edit.build({
                    walletAddress: user?.friendlyWalletAddress || '',
                  })}
                  viewTransition
                >
                  <Button stretch>
                    {t('common.edit')} <Pencil1Icon />
                  </Button>
                </Link>
              )}
              <Button
                stretch
                variant="outline"
                color="neutral"
                onClick={onShareProfile}
              >
                {t('common.share')} <Share1Icon />
              </Button>
            </Flex>
          )}
        </Flex>
      </StyledCard>
      <Modal
        open={qrModalOpened}
        onOpenChange={setQrModalOpened}
        showClose
        showTitleSeparator={false}
        title={
          <Flex align={'center'} direction={'column'}>
            <Text size={'4'} weight={'medium'}>
              {t('profile.view.qrModal.title')}
            </Text>
          </Flex>
        }
        width={isDesktop ? '450px' : undefined}
      >
        <Flex direction={'column'} align={'center'} gap={'3'}>
          <QRCodeSVG
            value={user?.friendlyWalletAddress || ''}
            size={isMobile ? 200 : 260}
            level="M"
            fgColor="var(--ds-accent-11)"
            bgColor="transparent"
            marginSize={1}
          />
          <Text size={isMobile ? '1' : '2'} align={'center'}>
            {t('profile.view.qrModal.description')}
          </Text>
        </Flex>
      </Modal>
    </>
  )
}

const StyledCard = styled(ProfileViewCard)`
  box-shadow: var(--shadow-4);
  height: 100%;
  ${(p) => p.theme.breakpoints.down('md')} {
    border-bottom: none;
    padding-top: var(--space-3);
    padding-bottom: 0;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  ${(p) => p.theme.breakpoints.up('md')} {
    padding: 33px;
  }
`

const QrCodeWrapper = styled.div<{ $size: number }>`
  width: ${(p) => p.$size}px;
  height: ${(p) => p.$size}px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 100%;
    height: 100%;
  }
`
