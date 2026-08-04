import { CopyIcon, ExternalLinkIcon } from '@radix-ui/react-icons'
import { Flex, Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'

import { $balance, $balanceLoading } from '../model'

import { AddressBox, BalanceSectionCard, QrPlaceholder } from './styled'

import { Button, Text, copyToClipboard, showToast } from '@/shared'

export const TopUpCard = () => {
  const { t } = useTranslation()
  const { balance, loading } = useUnit({
    balance: $balance,
    loading: $balanceLoading,
  })

  const address = balance?.tonAddress ?? ''

  const handleCopy = () => {
    if (!address) {
      return
    }

    copyToClipboard(address).then(() => {
      showToast('info', {
        message: t('balance.topUp.copied'),
        position: 'top-center',
      })
    })
  }

  const handleOpenInWallet = () => {
    if (!address) {
      return
    }

    window.open(`ton://transfer/${address}`, '_blank')
  }

  return (
    <BalanceSectionCard>
      <Flex
        direction={{ initial: 'column', md: 'row' }}
        gap={'5'}
        align={{ md: 'center' }}
      >
        <QrPlaceholder>QR</QrPlaceholder>
        <Flex direction={'column'} gap={'3'} flexGrow={'1'}>
          <Flex direction={'column'} gap={'1'}>
            <Text size={'4'} weight={'medium'}>
              {t('balance.topUp.title')}
            </Text>
            <Text size={'2'} color={'gray'}>
              {t('balance.topUp.description')}
            </Text>
          </Flex>
          <Skeleton loading={loading}>
            <AddressBox>{address || '—'}</AddressBox>
          </Skeleton>
          <Flex gap={'2'} wrap={'wrap'}>
            <Button
              variant="soft"
              color="neutral"
              onClick={handleCopy}
              disabled={!address}
            >
              <CopyIcon />
              <Text>{t('balance.topUp.copyAddress')}</Text>
            </Button>
            <Button
              variant="soft"
              color="neutral"
              onClick={handleOpenInWallet}
              disabled={!address}
            >
              <ExternalLinkIcon />
              <Text>{t('balance.topUp.openInWallet')}</Text>
            </Button>
          </Flex>
        </Flex>
      </Flex>
    </BalanceSectionCard>
  )
}
