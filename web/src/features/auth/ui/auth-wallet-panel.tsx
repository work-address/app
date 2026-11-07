import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { AuthLastUsed } from './auth-last-used'

import { LocalWalletSteps, type LocalWalletFlow } from '@/features/local-wallet'
import { useBreakpoint } from '@/shared'

type Props = {
  /** Owned by the page, which shows less around the wallet's later steps. */
  flow: LocalWalletFlow
  lastUsed?: boolean
}

/**
 * The browser wallet run in place. The two steps a visitor lands on introduce
 * it; the page's heading names the rest.
 */
export const AuthWalletPanel = ({ flow, lastUsed }: Props) => {
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
      {landing && (
        <Header>
          <TitleRow>
            <Title>{t('signIn.wallet.title')}</Title>
            {lastUsed && <AuthLastUsed />}
          </TitleRow>
          {step === 'choose' && <Lead>{t('signIn.wallet.lead')}</Lead>}
        </Header>
      )}
      <LocalWalletSteps flow={flow} autoFocus={isDesktop} />
    </Root>
  )
}

const Root = styled.div`
  display: grid;
  gap: var(--ui-space-4);
`

const Header = styled.header`
  display: grid;
  gap: var(--ui-space-1);
`

const TitleRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-2);
`

const Title = styled.h2`
  margin: 0;
  font-size: var(--ui-description-size);
  font-weight: 600;
  line-height: 1.3;
  color: var(--ui-ink);
`

const Lead = styled.p`
  margin: 0;
  font-size: var(--ui-meta-size);
  line-height: 20px;
  color: var(--ui-muted);
`
