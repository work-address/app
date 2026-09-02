import { EyeOpenIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { $localWallet, removeLocalWalletFx } from '../model'

import { LocalWalletExportDialog } from './local-wallet-export-dialog'

import { $user } from '@/entities/profile'
import {
  Button,
  Card,
  normalizeAddress,
  showToast,
  Text,
  useConfirm,
  type CardProps,
} from '@/shared'

/**
 * The wallet this browser holds, on the profile page: where it is, what it
 * is, and the two things a person may need to do with it - back the key up,
 * or get rid of it.
 */
export const LocalWalletCard = () => {
  const { t } = useTranslation()
  const { confirm } = useConfirm()
  const [exportOpen, setExportOpen] = useState(false)

  const { wallet, user, remove } = useUnit({
    wallet: $localWallet,
    user: $user,
    remove: removeLocalWalletFx,
  })

  if (!wallet) {
    return null
  }

  const isCurrentAccount =
    Boolean(user?.address) &&
    normalizeAddress(user?.address ?? '') === normalizeAddress(wallet.address)

  const handleRemove = () => {
    confirm({
      title: t('localWallet.remove.title'),
      description: t('localWallet.remove.description'),
      confirmLabel: t('localWallet.remove.confirm'),
      cancelLabel: t('common.cancel'),
    })
      .then(() => {
        remove()
        showToast('info', {
          message: t('localWallet.removed'),
          position: 'top-center',
        })
      })
      .catch(() => {})
  }

  return (
    <Root shadow={false}>
      <Flex direction="column" gap="3">
        <Text size="6" weight="medium">
          {t('localWallet.card.title')}
        </Text>
        <Text size="2" color="gray">
          {t('localWallet.card.description')}
        </Text>
        <AddressBox>
          <Text size="1" color="gray">
            {t('localWallet.card.address')}
          </Text>
          <Text size="2" weight="medium" $themeVariant="primary">
            {wallet.address}
          </Text>
          {!isCurrentAccount && (
            <Text size="1" color="amber">
              {t('localWallet.card.mismatch')}
            </Text>
          )}
        </AddressBox>
        <Actions>
          <Button
            variant="outline"
            color="neutral"
            iconLeft={<EyeOpenIcon />}
            onClick={() => setExportOpen(true)}
          >
            {t('localWallet.card.export')}
          </Button>
          <Button variant="outline" color="danger" onClick={handleRemove}>
            {t('localWallet.card.remove')}
          </Button>
        </Actions>
      </Flex>
      <LocalWalletExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </Root>
  )
}

const Root = styled(Card)<CardProps>`
  box-shadow: none;

  ${(p) => p.theme.breakpoints.down('md')} {
    border: none;
  }
`

const AddressBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-2);
  background: var(--ds-neutral-2);
  overflow-wrap: anywhere;
`

const Actions = styled.div`
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
`
