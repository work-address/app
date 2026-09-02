import { useTranslation } from 'react-i18next'

import { BackupStep } from './backup-step'
import { ChooseStep } from './choose-step'
import { CreateForm } from './create-form'
import { ImportForm } from './import-form'
import { RevealStep } from './reveal-step'
import { UnlockForm } from './unlock-form'
import { useLocalWalletFlow } from './use-local-wallet-flow'

import type { Step } from './types'

import { AdaptiveDialog, DIALOG_WIDTH_STANDARD } from '@/shared'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
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
 * The sign-in path for someone with no wallet app.
 *
 * Opens on "unlock" when this browser already holds a wallet, and on the
 * create/import choice when it does not. A freshly created key is shown once
 * for backing up before it signs anything: the keystore lives in this
 * browser alone, and without a copy of the key the account is lost with it.
 * The unlock step can also show the key again, behind the password.
 */
export const LocalWalletDialog = ({ open, onOpenChange }: Props) => {
  const { t } = useTranslation()
  const flow = useLocalWalletFlow({ open, onOpenChange })
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
          busy={busy}
          submitError={submitError}
          onBack={() => flow.setStep('choose')}
          onSubmit={flow.create}
        />
      )}
      {step === 'backup' && unlocked && (
        <BackupStep
          privateKey={unlocked.privateKey}
          busy={busy}
          submitError={submitError}
          onContinue={() => flow.signIn(unlocked)}
        />
      )}
      {step === 'import' && (
        <ImportForm
          busy={busy}
          submitError={submitError}
          replacing={wallet?.address}
          onBack={() => flow.setStep(wallet ? 'unlock' : 'choose')}
          onSubmit={flow.importKey}
        />
      )}
      {step === 'unlock' && wallet && (
        <UnlockForm
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
