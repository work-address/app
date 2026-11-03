import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { AuthMethod } from './auth-method'
import { AuthSteps } from './auth-steps'

import {
  LOCAL_WALLET_STEP_TITLE_KEY,
  LocalWalletSteps,
  type LocalWalletFlow,
} from '@/features/local-wallet'
import { useBreakpoint, WalletIcon } from '@/shared'

type Props = {
  /** Owned by the page, which holds its other sign-in option back at times. */
  flow: LocalWalletFlow
  /** Only beside Google is there a choice to help with. */
  choosing: boolean
}

const STEP_KEYS = ['step1', 'step2', 'step3']

/**
 * The browser wallet run in place. The two steps a visitor lands on share one
 * heading, and the rest name what they do. Only someone with no wallet yet needs
 * telling what's ahead.
 */
export const AuthWalletPanel = ({ flow, choosing }: Props) => {
  const { t } = useTranslation()
  const isDesktop = useBreakpoint('isDesktop')
  const { step } = flow
  const landing = step === 'choose' || step === 'unlock'

  // A dialog can refuse to close on this step, but a page can only warn: the
  // key on screen is the one copy of it the person has been shown.
  useEffect(() => {
    if (step !== 'backup') {
      return
    }

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }

    window.addEventListener('beforeunload', warn)

    return () => window.removeEventListener('beforeunload', warn)
  }, [step])

  return (
    <AuthMethod
      iconUrl={WalletIcon}
      eyebrow={landing && choosing ? t('signIn.wallet.eyebrow') : undefined}
      title={t(
        landing ? 'signIn.wallet.title' : LOCAL_WALLET_STEP_TITLE_KEY[step],
      )}
      lead={step === 'choose' ? t('signIn.wallet.lead') : undefined}
      after={
        step === 'choose' ? (
          <AuthSteps
            label={t('signIn.next')}
            steps={STEP_KEYS.map((key) => ({
              text: t(`signIn.wallet.${key}`),
            }))}
          />
        ) : undefined
      }
    >
      <LocalWalletSteps flow={flow} autoFocus={isDesktop} />
    </AuthMethod>
  )
}
