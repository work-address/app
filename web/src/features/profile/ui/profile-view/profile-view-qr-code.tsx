import { CopyIcon, Pencil1Icon, Share1Icon } from '@radix-ui/react-icons'
import { Flex, Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import styled from 'styled-components'

import { $profile, $isAuthenticatedUserProfile } from '../../model'

import { ProfileViewCard } from './profile-view-styles'

import { $pending } from '@/entities/profile'
import { LocalWalletRevealButton } from '@/features/local-wallet'
import { routes } from '@/routes'
import {
  Text,
  useBreakpoint,
  Button,
  Modal,
  Tooltip,
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
  const displayName = user?.name || user?.title

  return (
    <>
      <Root $gridArea={gridArea} shadow={false}>
        <Flex
          direction={'column'}
          gap={{ initial: '4' }}
          align={'center'}
          style={{ height: '100%' }}
        >
          {isMobile && (
            <Flex direction={'column'} align={'center'} gap={{ initial: '2' }}>
              {profileLoading ? (
                <Skeleton width={'180px'} height={'28px'} loading />
              ) : (
                displayName && (
                  <Text size={'6'} weight={'medium'}>
                    {displayName}
                  </Text>
                )
              )}
              <Flex gap={'2'} align={'center'}>
                {profileLoading ? (
                  <Skeleton width={'130px'} height={'18px'} loading />
                ) : (
                  user?.friendlyWalletAddress && (
                    <Tooltip content={t('profile.view.copyAddressHint')}>
                      <Button
                        variant="ghost"
                        color="neutral"
                        onClick={onWalletAddressCopy}
                        aria-label={t('profile.view.copyAddressHint')}
                      >
                        <Text
                          $themeVariant={'primary'}
                          size={'2'}
                          weight={'medium'}
                        >
                          {formatWalletAddress(user.friendlyWalletAddress)}
                        </Text>
                        <CopyIcon />
                      </Button>
                    </Tooltip>
                  )
                )}
              </Flex>
            </Flex>
          )}
          <Tooltip content={t('profile.view.qrOpenHint')}>
            <QrCodeWrapper
              $size={qrCodeSize}
              role="button"
              tabIndex={0}
              aria-label={t('profile.view.qrOpenHint')}
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
          </Tooltip>
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
              {isAuthenticatedUserProfile && (
                <LocalWalletRevealButton address={user?.address} stretch />
              )}
            </Flex>
          )}
        </Flex>
      </Root>
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

/* A whole card on a phone. It used to lose its bottom edge so the links card
   could continue it, but that card is often empty there, and a card that ends
   in nothing looked like a rendering fault. */
const Root = styled(ProfileViewCard)`
  box-shadow: var(--shadow-4);
  height: 100%;

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
