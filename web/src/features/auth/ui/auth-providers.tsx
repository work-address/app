import { LockClosedIcon } from '@radix-ui/react-icons'
import { useUnit } from 'effector-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { AuthProviderButton } from './auth-provider-button'

import type { SignInGuideMode } from './auth-sign-in-guide'
import type { LoginMode } from '@/entities/profile'

import { login } from '@/entities/profile'
import { $localWallet, LocalWalletDialog } from '@/features/local-wallet'
import {
  EthereumLogo,
  formatWalletAddress,
  SolanaLogo,
  TonLogo,
} from '@/shared'

type Props = {
  /** Told which option the pointer or focus is on, to explain that one. */
  onGuideChange?: (mode: SignInGuideMode) => void
}

/**
 * Every way to sign in, in one order: the three wallet-app networks, then
 * the browser-kept local wallet. Rendered bare, so each page lays the options
 * out in its own column, and shared, so sign-in and connect never drift.
 */
export const AuthProviders = ({ onGuideChange }: Props) => {
  const { t } = useTranslation()
  const [localWalletOpen, setLocalWalletOpen] = useState(false)
  const localWallet = useUnit($localWallet)

  const providers = [
    {
      mode: 'ton',
      iconUrl: TonLogo,
      iconAlt: t('signIn.alt.ton'),
      label: t('signIn.providers.ton'),
    },
    {
      mode: 'solana',
      iconUrl: SolanaLogo,
      iconAlt: t('signIn.alt.solana'),
      label: t('signIn.providers.solana'),
    },
    {
      mode: 'eth',
      iconUrl: EthereumLogo,
      iconAlt: t('signIn.alt.ethereum'),
      label: t('signIn.providers.ethereum'),
    },
  ] satisfies {
    mode: LoginMode
    iconUrl: string
    iconAlt: string
    label: string
  }[]

  return (
    <>
      {providers.map((provider) => (
        <AuthProviderButton
          key={provider.mode}
          iconUrl={provider.iconUrl}
          iconAlt={provider.iconAlt}
          onClick={() => login(provider.mode)}
          onMouseEnter={() => onGuideChange?.(provider.mode)}
          onFocus={() => onGuideChange?.(provider.mode)}
        >
          {provider.label}
        </AuthProviderButton>
      ))}
      <OrRow aria-hidden="true">
        <span>{t('signIn.local.or')}</span>
      </OrRow>
      {/* For people with no wallet app: a key the app keeps for them,
          encrypted in this browser behind a password. */}
      <AuthProviderButton
        variant="primary"
        icon={<LockClosedIcon width={16} height={16} />}
        onClick={() => setLocalWalletOpen(true)}
        onMouseEnter={() => onGuideChange?.('local')}
        onFocus={() => onGuideChange?.('local')}
      >
        {localWallet
          ? t('signIn.local.option.continue', {
              address: formatWalletAddress(localWallet.address),
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
