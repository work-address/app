import { CopyIcon, Pencil1Icon, Share1Icon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import styled from 'styled-components'

import { $profile } from '../../model'

import { ProfileViewCard } from './styled'

import {
  Text,
  useBreakpoint,
  Button,
  Modal,
  showToast,
  formatWalletAddress,
} from '@/features/shared'
import { routes } from '@/routes'

type QrCodeProps = {
  gridArea?: string
  padding?: string
}

export const QrCode = ({ gridArea }: QrCodeProps) => {
  const isMobile = useBreakpoint('isMobile')
  const isDesktop = useBreakpoint('isDesktop')

  const { t } = useTranslation()
  const user = useUnit($profile)

  const [qrModalOpened, setQrModalOpened] = useState(false)

  const walletAddress = formatWalletAddress(user?.friendlyWalletAddress || '')

  const handleCopyWalletAddress = async () => {
    await navigator.clipboard.writeText(user?.friendlyWalletAddress || '')

    showToast('info', {
      message: 'Address copied to clipboard',
      position: 'top-center',
    })
  }

  return (
    <>
      <StyledCard gridArea={gridArea} shadow={false}>
        <Flex
          direction={'column'}
          gap={{ initial: '4' }}
          align={'center'}
          style={{ height: '100%' }}
        >
          {isMobile && (
            <Flex direction={'column'} align={'center'} gap={{ initial: '2' }}>
              <Text size={'6'} weight={'medium'}>
                {user?.userName ?? t('profile.view.mockName')}
              </Text>

              <Flex gap={'2'} align={'center'}>
                <Button variant={'ghost'} onClick={handleCopyWalletAddress}>
                  <Text $themeVariant={'primary'} size={'2'} weight={'medium'}>
                    {walletAddress}
                  </Text>

                  <CopyIcon />
                </Button>
              </Flex>
            </Flex>
          )}

          <QrCodeWrapper onClick={() => setQrModalOpened(true)}>
            <QRCodeSVG
              value={user?.friendlyWalletAddress || ''}
              size={isMobile ? 140 : 180}
              level="M"
              fgColor="var(--ds-accent-11)"
              bgColor="transparent"
              marginSize={1}
            />
          </QrCodeWrapper>

          {isMobile ? (
            <Flex gap={'2'} direction={'column'} width={'100%'}>
              <Link to={routes.profile.children.edit.build()}>
                <Button stretch themeVariant={'primary'}>
                  {t('common.edit')} <Pencil1Icon />
                </Button>
              </Link>

              <Button
                stretch
                variant={'outline'}
                color={'gray'}
                onClick={handleCopyWalletAddress}
              >
                {t('common.share')} <Share1Icon />
              </Button>
            </Link>

            <Button stretch variant={'outline'} color={'gray'}>
              {t('common.share')} <Share1Icon />
            </Button>
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
              Scan to Pay
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
            Use your crypto wallet to scan the QR code and send the payment
            instantly. Ensure the amount and recipient details are correct
            before confirming the transaction.
          </Text>
        </Flex>
      </Modal>
    </>
  )
}

const StyledCard = styled(ProfileViewCard)`
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

const QrCodeWrapper = styled.div`
  width: 140px;
  height: 140px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  ${(p) => p.theme.breakpoints.up('md')} {
    width: 180px;
    height: 180px;
  }

  svg {
    width: 100%;
    height: 100%;
  }
`
