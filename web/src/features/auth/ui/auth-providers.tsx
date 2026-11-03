import { LockClosedIcon } from '@radix-ui/react-icons'
import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { AuthGoogleButton } from './auth-google-button'
import { AuthProviderButton } from './auth-provider-button'

import type { SignInGuideMode } from './auth-sign-in-guide'

import { $googleClientId, fetchAuthMethodsFx } from '@/entities/profile'
import { $localWallet, LocalWalletDialog } from '@/features/local-wallet'
import { formatAddress } from '@/shared'

type Props = {
  /** Told which option the pointer or focus is on, to explain that one. */
  onGuideChange?: (mode: SignInGuideMode) => void
}

/**
 * Every way to sign in: Google where this deployment offers it, then the
 * browser-kept wallet, which needs nothing outside the deployment. Rendered
 * bare, so each page lays the options out in its own column, and shared, so
 * sign-in and connect never drift.
 */
export const AuthProviders = ({ onGuideChange }: Props) => {
  const { t } = useTranslation()
  const [localWalletOpen, setLocalWalletOpen] = useState(false)
  const { localWallet, googleClientId, fetchMethods } = useUnit({
    localWallet: $localWallet,
    googleClientId: $googleClientId,
    fetchMethods: fetchAuthMethodsFx,
  })

  useEffect(() => {
    fetchMethods().catch(() => {})
  }, [fetchMethods])

  return (
    <>
      {googleClientId && (
        <>
          <AuthGoogleButton
            clientId={googleClientId}
            onMouseEnter={() => onGuideChange?.('google')}
          />
          <OrRow aria-hidden="true">
            <span>{t('signIn.local.or')}</span>
          </OrRow>
        </>
      )}
      {/* A key the app keeps for them, encrypted in this browser behind a
          password. */}
      <AuthProviderButton
        variant={googleClientId ? 'default' : 'primary'}
        icon={<LockClosedIcon width={16} height={16} />}
        onClick={() => setLocalWalletOpen(true)}
        onMouseEnter={() => onGuideChange?.('local')}
        onFocus={() => onGuideChange?.('local')}
      >
        {localWallet
          ? t('signIn.local.option.continue', {
              address: formatAddress(localWallet.address),
            })
          : t('signIn.local.option.create')}
      </AuthProviderButton>
      <LocalWalletDialog
        open={localWalletOpen}
        onOpenChange={setLocalWalletOpen}
      />
    </>
  )
}

const OrRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 2px 0;
  font-size: var(--font-size-1);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ds-neutral-11);

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--ds-neutral-alpha-6);
  }
`
