import { Skeleton } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { AuthGoogleButton } from './auth-google-button'
import { AuthMethod } from './auth-method'
import { AuthSteps } from './auth-steps'

import { GoogleIcon } from '@/shared'

type Props = {
  /** Unknown until the deployment has said whether it offers Google. */
  clientId: string | null
}

const STEP_KEYS = ['step1', 'step2', 'step3']

/**
 * The sign-in page's Google half. Holds its place while the deployment answers,
 * so the page doesn't draw a wallet-only screen and then snap into two halves.
 */
export const AuthGooglePanel = ({ clientId }: Props) => {
  const { t } = useTranslation()

  if (!clientId) {
    return (
      <Placeholder aria-hidden="true">
        <Skeleton width="70%" height="48px" loading />
        <Skeleton width="85%" height="20px" loading />
        <Skeleton width="100%" height="40px" loading />
      </Placeholder>
    )
  }

  return (
    <AuthMethod
      iconUrl={GoogleIcon}
      eyebrow={t('signIn.google.eyebrow')}
      title={t('signIn.google.title')}
      lead={t('signIn.google.lead')}
      after={
        <AuthSteps
          label={t('signIn.next')}
          steps={STEP_KEYS.map((key) => t(`signIn.google.${key}`))}
        />
      }
    >
      <AuthGoogleButton clientId={clientId} />
    </AuthMethod>
  )
}

const Placeholder = styled.div`
  display: grid;
  gap: var(--space-4);
`
