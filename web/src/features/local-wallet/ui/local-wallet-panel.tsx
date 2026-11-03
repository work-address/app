import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  LOCAL_WALLET_STEP_TITLE_KEY,
  LocalWalletSteps,
  type LocalWalletFlow,
} from './local-wallet-dialog'

import { useBreakpoint } from '@/shared'

type Props = {
  /** Owned by the page, which holds its other sign-in option back at times. */
  flow: LocalWalletFlow
}

/**
 * The browser wallet run in place, for a page with room to give it. The two
 * steps a visitor lands on share one heading; the rest name what they do.
 */
export const LocalWalletPanel = ({ flow }: Props) => {
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
    <Root>
      <Header>
        <Title>
          {t(
            landing ? 'signIn.wallet.title' : LOCAL_WALLET_STEP_TITLE_KEY[step],
          )}
        </Title>
        {step === 'choose' && <Lead>{t('signIn.wallet.lead')}</Lead>}
      </Header>
      <LocalWalletSteps flow={flow} autoFocus={isDesktop} />
    </Root>
  )
}

const Root = styled.div`
  display: grid;
  gap: var(--space-5);
`

const Header = styled.header`
  display: grid;
  gap: var(--space-2);
`

const Title = styled.h2`
  margin: 0;
  font-size: var(--font-size-6);
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.01em;
  color: var(--ds-neutral-12);
`

const Lead = styled.p`
  margin: 0;
  font-size: var(--font-size-3);
  line-height: 1.5;
  color: var(--ds-neutral-11);
`
