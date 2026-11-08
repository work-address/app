import { Flex, Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { $profile, $profileLoading } from '../../model'

import { Modal, Text, Tooltip, useBreakpoint } from '@/shared'

type Props = {
  className?: string
}

/** Pixels the code is drawn at; CSS decides what it is shown at. */
const QR_DRAWN_SIZE = 240

/* The wordmark's blue on white: dark enough (about 5.9:1) for any scanner. */
const QR_INK = '#3F67A4'
const QR_PAPER = '#ffffff'

/** The wallet as a code beside the name; a tap opens it larger to scan. */
export const ProfileViewQrCode = ({ className }: Props) => {
  const isMobile = useBreakpoint('isMobile')
  const isDesktop = useBreakpoint('isDesktop')

  const { t } = useTranslation()

  const { user, profileLoading } = useUnit({
    user: $profile,
    profileLoading: $profileLoading,
  })

  const [qrModalOpened, setQrModalOpened] = useState(false)
  const payWallet = user?.payWallet

  return (
    <>
      <Tooltip content={t('profile.view.qrOpenHint')}>
        <Root
          className={className}
          type="button"
          disabled={profileLoading || !payWallet}
          aria-label={t('profile.view.qrOpenHint')}
          onClick={() => setQrModalOpened(true)}
        >
          <Skeleton loading={profileLoading}>
            <QRCodeSVG
              value={payWallet || ''}
              size={QR_DRAWN_SIZE}
              level="M"
              fgColor={QR_INK}
              bgColor={QR_PAPER}
              marginSize={1}
            />
          </Skeleton>
        </Root>
      </Tooltip>
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
            value={payWallet || ''}
            size={isMobile ? 200 : 260}
            level="M"
            fgColor={QR_INK}
            bgColor={QR_PAPER}
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

const Root = styled.button`
  width: 160px;
  height: 160px;
  cursor: pointer;
  padding: 0;
  border: 0;
  background: transparent;
  border-radius: var(--ui-row-radius);
  display: grid;
  place-items: stretch;

  &:focus-visible {
    outline: var(--ui-focus-width) solid var(--ui-blue);
    outline-offset: var(--ui-focus-offset);
  }

  &:disabled {
    cursor: default;
  }

  svg {
    width: 100%;
    height: 100%;
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    width: 112px;
    height: 112px;
  }
`
