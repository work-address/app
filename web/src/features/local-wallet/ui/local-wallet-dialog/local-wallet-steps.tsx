import { useTranslation } from 'react-i18next'

import { BackupStep } from './backup-step'
import { ChooseStep } from './choose-step'
import { CreateForm } from './create-form'
import { ImportForm } from './import-form'
import { RevealStep } from './reveal-step'
import { UnlockForm } from './unlock-form'

import type { Step } from './types'
import type { LocalWalletFlow } from './use-local-wallet-flow'

type Props = {
  flow: LocalWalletFlow
  /** Connects the key to the signed-in account, rather than signing in. */
  connecting?: boolean
  /** Off where focusing a field would open a phone's keyboard unasked. */
  autoFocus?: boolean
}

const SUBMIT_KEYS = {
  signIn: {
    create: 'localWallet.actions.create',
    import: 'localWallet.actions.import',
    backup: 'localWallet.backup.continue',
    unlock: 'localWallet.unlock.submitShort',
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

export const LOCAL_WALLET_STEP_TITLE_KEY: Record<Step, string> = {
  choose: 'localWallet.dialog.title',
  create: 'localWallet.create.title',
  backup: 'localWallet.backup.title',
  import: 'localWallet.import.title',
  unlock: 'localWallet.unlock.title',
  reveal: 'localWallet.export.title',
}

/**
 * The wallet's steps, whatever holds them: the sign-in page runs them in place,
 * and a dialog runs them everywhere else, so the two can't behave differently.
 */
export const LocalWalletSteps = ({ flow, connecting, autoFocus }: Props) => {
  const { t } = useTranslation()
  const submit = SUBMIT_KEYS[connecting ? 'connect' : 'signIn']
  const { step, busy, submitError, unlocked, wallet } = flow

  return (
    <>
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
          autoFocus={autoFocus}
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
          autoFocus={autoFocus}
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
      {/* `phase` is read so the steps re-render as the status line changes
          under a form that is otherwise static while busy. */}
      <span hidden data-phase={flow.phase} />
    </>
  )
}
