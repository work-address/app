import { Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { AuthGoogleButton } from './auth-google-button'
import { AuthLastUsed } from './auth-last-used'

import { $googleScriptState, $googleSignInError } from '@/entities/profile'

type Props = {
  /** Unknown until the deployment has said whether it offers Google. */
  clientId: string | null
  lastUsed?: boolean
}

/**
 * The sign-in screen's Google option. Holds its place while the deployment
 * answers, so the form doesn't draw wallet-only and then jump down.
 */
export const AuthGooglePanel = ({ clientId, lastUsed }: Props) => {
  const { t } = useTranslation()
  const { scriptState, error } = useUnit({
    scriptState: $googleScriptState,
    error: $googleSignInError,
  })
  // Selling the quick way in would read wrongly under a failure of it.
  const working = scriptState !== 'failed' && !error

  if (!clientId) {
    return (
      <Root aria-hidden="true">
        <Skeleton width="100%" height="40px" loading />
        <Skeleton width="60%" height="20px" loading />
      </Root>
    )
  }

  return (
    <Root>
      <AuthGoogleButton clientId={clientId} />
      {working && (
        <Note>
          {lastUsed && <AuthLastUsed />}
          <Lead>{t('signIn.google.lead')}</Lead>
        </Note>
      )}
    </Root>
  )
}

const Root = styled.div`
  display: grid;
  justify-items: center;
  gap: var(--space-2);
`

const Note = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
`

const Lead = styled.p`
  margin: 0;
  text-align: center;
  font-size: var(--font-size-2);
  line-height: 20px;
  color: var(--ds-neutral-11);
`
