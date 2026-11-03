import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  LOCAL_WALLET_STEP_TITLE_KEY,
  LocalWalletSteps,
} from './local-wallet-steps'
import { useLocalWalletFlow } from './use-local-wallet-flow'

import type { UnlockedLocalWallet } from '../../model'

import { AdaptiveDialog, DIALOG_WIDTH_STANDARD, Text } from '@/shared'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Connects the unlocked key to the signed-in account instead of signing in. */
  onConnect?: (wallet: UnlockedLocalWallet) => Promise<unknown>
}

/**
 * The browser wallet in a dialog, for pages with no room to run it in place:
 * tracker pairing, and one way for a Google account to connect a wallet.
 *
 * Opens on "unlock" when this browser already holds a wallet, and on the
 * create/import choice when it does not. A freshly created key is shown once
 * for backing up before it signs anything: the keystore lives in this
 * browser alone, and without a copy of the key the account is lost with it.
 * The unlock step can also show the key again, behind the password.
 */
export const LocalWalletDialog = ({ open, onOpenChange, onConnect }: Props) => {
  const { t } = useTranslation()
  const flow = useLocalWalletFlow({
    open,
    onOpenChange,
    onUnlocked: onConnect,
  })
  const { step, busy } = flow

  return (
    <AdaptiveDialog
      open={open}
      onOpenChange={(next) => {
        // Not while a key is being derived, and not while a fresh key is on
        // screen unsaved - closing there would lose the only copy.
        if (!busy && step !== 'backup') {
          onOpenChange(next)
        }
      }}
      title={t(LOCAL_WALLET_STEP_TITLE_KEY[step])}
      desktopWidth={DIALOG_WIDTH_STANDARD}
      desktopShowClose={step !== 'backup'}
    >
      {step === 'choose' && (
        <Intro size="3" color="gray">
          {t('localWallet.choose.intro')}
        </Intro>
      )}
      <LocalWalletSteps flow={flow} connecting={Boolean(onConnect)} autoFocus />
    </AdaptiveDialog>
  )
}

const Intro = styled(Text)`
  display: block;
  margin-bottom: var(--space-4);
`
