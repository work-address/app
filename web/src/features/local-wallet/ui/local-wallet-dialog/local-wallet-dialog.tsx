import { useTranslation } from 'react-i18next'

import { BackupStep } from './backup-step'
import { ChooseStep } from './choose-step'
import { CreateForm } from './create-form'
import { ImportForm } from './import-form'
import { RevealStep } from './reveal-step'
import { UnlockForm } from './unlock-form'
import { useLocalWalletFlow } from './use-local-wallet-flow'

import type { Step } from './types'
import type { UnlockedLocalWallet } from '../../model'

import { AdaptiveDialog, DIALOG_WIDTH_STANDARD } from '@/shared'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Connects the unlocked key to the signed-in account instead of signing in. */
  onConnect?: (wallet: UnlockedLocalWallet) => Promise<unknown>
}

const SUBMIT_KEYS = {
  signIn: {
    create: 'localWallet.actions.create',
    import: 'localWallet.actions.import',
    backup: 'localWallet.backup.continue',
    unlock: 'localWallet.unlock.submit',
    reveal: 'localWallet.unlock.submitShort',
  },
  connect: {
    create: 'localWallet.connect.create',
    import: 'localWallet.connect.import',
    backup: 'localWallet.connect.backup',
    unlock: 'localWallet.connect.unlock',
    reveal: 'localWallet.connect.reveal',
  },
}

const TITLE_KEY: Record<Step, string> = {
  choose: 'localWallet.dialog.title',
  create: 'localWallet.create.title',
  backup: 'localWallet.backup.title',
  import: 'localWallet.import.title',
  unlock: 'localWallet.unlock.title',
  reveal: 'localWallet.export.title',
}

/**
 * The browser wallet: the sign-in path that needs nothing outside this
 * deployment, and one way for a Google account to connect a wallet.
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
  const submit = SUBMIT_KEYS[onConnect ? 'connect' : 'signIn']
  const { step, busy, submitError, unlocked, wallet } = flow

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
      title={t(TITLE_KEY[step])}
      desktopWidth={DIALOG_WIDTH_STANDARD}
      desktopShowClose={step !== 'backup'}
    >
      {step === 'choose' && (
        <ChooseStep
          onCreate={() => flow.setStep('create')}
          onImport={() => flow.setStep('import')}
        />
      )}
      {step === 'create' && (
        <CreateForm
          submitLabel={t(submit.create)}
          busy={busy}
          submitError={submitError}
          onBack={() => flow.setStep('choose')}
          onSubmit={flow.create}
        />
      )}
      {step === 'backup' && unlocked && (
        <BackupStep
          submitLabel={t(submit.backup)}
          privateKey={unlocked.privateKey}
          busy={busy}
          submitError={submitError}
          onContinue={() => flow.signIn(unlocked)}
        />
      )}
      {step === 'import' && (
        <ImportForm
          submitLabel={t(submit.import)}
          busy={busy}
          submitError={submitError}
          replacing={wallet?.address}
          onBack={() => flow.setStep(wallet ? 'unlock' : 'choose')}
          onSubmit={flow.importKey}
        />
      )}
      {step === 'unlock' && wallet && (
        <UnlockForm
          submitLabel={t(submit.unlock)}
          address={wallet.address}
          busy={busy}
          submitError={submitError}
          onImport={() => flow.setStep('import')}
          onForget={flow.forget}
          onSubmit={flow.unlock}
        />
      )}
      {step === 'reveal' && unlocked && (
        <RevealStep
          submitLabel={t(submit.reveal)}
          privateKey={unlocked.privateKey}
          busy={busy}
          submitError={submitError}
          onBack={flow.backFromReveal}
          onSignIn={() => flow.signIn(unlocked)}
        />
      )}
      {/* `phase` is read so the dialog re-renders as the status line changes
          under a form that is otherwise static while busy. */}
      <span hidden data-phase={flow.phase} />
    </AdaptiveDialog>
  )
}
