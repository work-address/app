import { CopyIcon, Pencil1Icon, Share1Icon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import styled from 'styled-components'

import { ProfileViewCard } from './styled'

import {
  routes,
  Text,
  useBreakpoints,
  Button,
  Modal,
  showToast,
} from '@/features/shared'

type QrCodeProps = {
  gridArea?: string
  padding?: string
}

export const QrCode = ({ gridArea }: QrCodeProps) => {
  const { t } = useTranslation()

  const [qrModalOpened, setQrModalOpened] = useState(false)

  const walletAddress = 'EQCF9...NDOM'

  const handleCopyWalletAddress = async () => {
    await navigator.clipboard.writeText(walletAddress)

    showToast('info', {
      message: 'Address copied to clipboard',
      position: 'top-center',
    })
  }

  return (
    <StyledCard gridArea={gridArea} shadow={false}>
      <Flex
        direction={'column'}
        gap={'3'}
        align={'center'}
        style={{ height: '100%' }}
      >
        {!isUpMd && (
          <>
            <Text size={'7'} weight={'medium'}>
              {t('profile.view.mockName')}
            </Text>

            <Flex gap={'2'} align={'center'}>
              <Text $themeVariant={'primary'} size={'3'} weight={'medium'}>
                EQCF9...NDOM
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

        <QrCodeImage
          src={'/img/photo/qr-code-example.svg'}
          alt={t('profile.view.qrAlt')}
        />

        {isUpMd ? (
          <Button width={'146px'} themeVariant={'primary'} size={'3'}>
            {t('profile.view.shareQr')}
          </Button>
        ) : (
          <Flex gap={'2'} direction={'column'} width={'100%'}>
            <Link to={routes.profile.children.edit.schema}>
              <Button stretch themeVariant={'primary'}>
                {t('common.edit')} <Pencil1Icon />
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
          <QrCodeImageModal
            src={'/img/photo/qr-code-example.svg'}
            alt={'qr-code'}
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

const QrCodeImage = styled.img`
  width: 140px;
  height: 140px;
  cursor: pointer;

  ${(p) => p.theme.breakpoints.up('md')} {
    width: 180px;
    height: 180px;
  }
`

const QrCodeImageModal = styled.img`
  width: 200px;
  height: 200px;

  ${(p) => p.theme.breakpoints.up('md')} {
    width: 260px;
    height: 260px;
  }
`
