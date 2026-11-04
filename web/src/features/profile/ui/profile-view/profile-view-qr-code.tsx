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
const QR_DRAWN_SIZE = 180

/** The wallet as a code, small beside the name; a tap opens it to scan. */
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
              fgColor="var(--ds-accent-11)"
              bgColor="transparent"
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

const Root = styled.button`
  width: 112px;
  height: 112px;
  cursor: pointer;
  padding: 0;
  border: 0;
  background: transparent;
  border-radius: var(--radius-2);
  display: grid;
  place-items: stretch;

  &:focus-visible {
    outline: 2px solid var(--ds-accent-9);
    outline-offset: 4px;
  }

  &:disabled {
    cursor: default;
  }

  svg {
    width: 100%;
    height: 100%;
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    width: 88px;
    height: 88px;
  }
`
