import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  $localWallet,
  $localWalletPhase,
  createLocalWalletFx,
  importLocalWalletFx,
  isLocalWalletError,
  removeLocalWalletFx,
  signInWithLocalWalletFx,
  unlockLocalWalletFx,
  type UnlockedLocalWallet,
} from '../../model'

import type { ImportFormValues, Step, UnlockIntent } from './types'
import type { PasswordFormValues } from '../local-wallet-fields'

import { showToast, useConfirm } from '@/shared'

type Params = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Everything the dialog does that is not markup: which step is showing, the
 * decrypted key held between steps, and the calls into the wallet model.
 *
 * The unlocked key lives only in component state, only between unlocking
 * and signing in (or while it is on screen for a backup), and is dropped the
 * moment the dialog closes.
 */
export const useLocalWalletFlow = ({ open, onOpenChange }: Params) => {
  const { t } = useTranslation()
  const { confirm } = useConfirm()

  const { wallet, phase, creating, importing, unlocking, signingIn, remove } =
    useUnit({
      wallet: $localWallet,
      phase: $localWalletPhase,
      creating: createLocalWalletFx.pending,
      importing: importLocalWalletFx.pending,
      unlocking: unlockLocalWalletFx.pending,
      signingIn: signInWithLocalWalletFx.pending,
      remove: removeLocalWalletFx,
    })

  const [step, setStep] = useState<Step>(wallet ? 'unlock' : 'choose')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState<UnlockedLocalWallet | null>(null)

  const busy = creating || importing || unlocking || signingIn

  // Each opening starts from the state of the browser, not from wherever the
  // last attempt left off.
  useEffect(() => {
    if (open) {
      setStep(wallet ? 'unlock' : 'choose')
      setSubmitError(null)
      setUnlocked(null)
    }
  }, [open, wallet])

  const describeError = (error: unknown) => {
    if (isLocalWalletError(error)) {
      if (error.code === 'wrong-password') {
        return t('localWallet.errors.wrongPassword')
      }

      if (error.code === 'invalid-key') {
        return t('localWallet.errors.invalidKey')
      }
    }

    return t('localWallet.errors.generic')
  }

  const signIn = async (target: UnlockedLocalWallet) => {
    setSubmitError(null)

    try {
      await signInWithLocalWalletFx(target)
      setUnlocked(null)
      onOpenChange(false)
    } catch (error) {
      setSubmitError(describeError(error))
    }
  }

  const create = async (values: PasswordFormValues) => {
    setSubmitError(null)

    try {
      const { wallet: created } = await createLocalWalletFx({
        password: values.password,
      })

      setUnlocked(created)
      setStep('backup')
    } catch (error) {
      setSubmitError(describeError(error))
    }
  }

  const importKey = async (values: ImportFormValues) => {
    setSubmitError(null)

    try {
      const { wallet: imported } = await importLocalWalletFx({
        privateKey: values.privateKey,
        password: values.password,
      })

      await signIn(imported)
    } catch (error) {
      setSubmitError(describeError(error))
    }
  }

  const unlock = async (values: PasswordFormValues, intent: UnlockIntent) => {
    setSubmitError(null)

    try {
      const target = await unlockLocalWalletFx({ password: values.password })

      if (intent === 'reveal') {
        setUnlocked(target)
        setStep('reveal')
        return
      }

      await signIn(target)
    } catch (error) {
      setSubmitError(describeError(error))
    }
  }

  const forget = () => {
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
        setStep('choose')
      })
      .catch(() => {})
  }

  const backFromReveal = () => {
    setUnlocked(null)
    setStep('unlock')
  }

  return {
    wallet,
    phase,
    step,
    setStep,
    busy,
    submitError,
    unlocked,
    signIn,
    create,
    importKey,
    unlock,
    forget,
    backFromReveal,
  }
}
