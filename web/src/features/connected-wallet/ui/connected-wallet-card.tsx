import { Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  connectInjectedWalletFx,
  connectWalletFx,
  disconnectWalletFx,
} from '../model'

import { $user } from '@/entities/profile'
import { LocalWalletDialog } from '@/features/local-wallet'
import {
  Button,
  findInjectedWallets,
  isEmailAddress,
  SectionTitle,
  WorkspaceSheet,
  showToast,
  Text,
  useConfirm,
  type InjectedWallet,
} from '@/shared'

/**
 * Where a Google account proves a wallet is its own. A wallet account has no
 * such card: its address already is its wallet.
 */
export const ConnectedWalletCard = () => {
  const { t } = useTranslation()
  const { confirm } = useConfirm()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [injected, setInjected] = useState<InjectedWallet[]>([])

  const { user, connect, connectInjected, disconnect, busy } = useUnit({
    user: $user,
    connect: connectWalletFx,
    connectInjected: connectInjectedWalletFx,
    disconnect: disconnectWalletFx,
    busy: connectInjectedWalletFx.pending,
  })

  const isGoogleAccount = isEmailAddress(user?.address ?? '')

  useEffect(() => {
    if (!isGoogleAccount) {
      return
    }

    let active = true

    findInjectedWallets().then((wallets) => {
      if (active) {
        setInjected(wallets)
      }
    })

    return () => {
      active = false
    }
  }, [isGoogleAccount])

  if (!isGoogleAccount) {
    return null
  }

  const report = (promise: Promise<unknown>, successKey: string) =>
    promise
      .then(() => {
        showToast('success', {
          message: t(successKey),
          position: 'top-center',
        })
      })
      .catch(() => {
        showToast('error', {
          message: t('connectedWallet.error'),
          position: 'top-center',
        })
      })

  const handleDisconnect = () => {
    confirm({
      title: t('connectedWallet.disconnect.title'),
      description: t('connectedWallet.disconnect.description'),
      confirmLabel: t('connectedWallet.disconnect.confirm'),
      cancelLabel: t('common.cancel'),
    })
      .then(() => report(disconnect(), 'connectedWallet.disconnect.success'))
      .catch(() => {})
  }

  return (
    <WorkspaceSheet>
      <Flex direction="column" gap="3">
        <SectionTitle>{t('connectedWallet.title')}</SectionTitle>
        <Text size="2" color="gray">
          {t('connectedWallet.description')}
        </Text>
        {user?.connectedWallet && (
          <AddressBox>
            <Text size="1" color="gray">
              {t('connectedWallet.current')}
            </Text>
            <Text size="2" weight="medium" $themeVariant="primary">
              {user.connectedWallet}
            </Text>
          </AddressBox>
        )}
        <Actions>
          <Button
            variant="outline"
            color="neutral"
            disabled={busy}
            onClick={() => setDialogOpen(true)}
          >
            {t('connectedWallet.useBrowserWallet')}
          </Button>
          {injected.map((wallet) => (
            <Button
              key={wallet.id}
              variant="outline"
              color="neutral"
              loading={busy}
              onClick={() => {
                report(connectInjected(wallet), 'connectedWallet.success')
              }}
            >
              {t('connectedWallet.useInjected', { name: wallet.name })}
            </Button>
          ))}
          {user?.connectedWallet && (
            <Button
              variant="outline"
              color="danger"
              disabled={busy}
              onClick={handleDisconnect}
            >
              {t('connectedWallet.disconnect.action')}
            </Button>
          )}
        </Actions>
        {injected.length === 0 && (
          <Text size="1" color="gray">
            {t('connectedWallet.noInjected')}
          </Text>
        )}
      </Flex>
      <LocalWalletDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConnect={(wallet) =>
          connect(wallet).then(() => {
            showToast('success', {
              message: t('connectedWallet.success'),
              position: 'top-center',
            })
          })
        }
      />
    </WorkspaceSheet>
  )
}

const AddressBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--ui-space-2) var(--ui-space-3);
  border-radius: var(--ui-control-radius);
  background: var(--ui-inset);
  overflow-wrap: anywhere;
`

const Actions = styled.div`
  display: flex;
  gap: var(--ui-space-3);
  flex-wrap: wrap;
`
