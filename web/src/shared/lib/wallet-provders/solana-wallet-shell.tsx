import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from '@solana/wallet-adapter-react'
import {
  WalletModalProvider,
  useWalletModal,
} from '@solana/wallet-adapter-react-ui'
import { clusterApiUrl } from '@solana/web3.js'
import { useGate } from 'effector-react'
import { useMemo } from 'react'
import { createGlobalStyle } from 'styled-components'

import {
  SolanaWalletGate,
  type SolanaWalletState,
} from '@/entities/profile/solana.model'

import '@solana/wallet-adapter-react-ui/styles.css'

const SolanaWalletBridge = () => {
  const { publicKey, signMessage, disconnect, connected } = useWallet()
  const { setVisible } = useWalletModal()

  const state = useMemo<SolanaWalletState>(
    () => ({
      publicKey: publicKey ?? null,
      signMessage,
      disconnect,
      openModal: setVisible,
      connected,
    }),
    [publicKey, signMessage, disconnect, setVisible, connected],
  )

  useGate(SolanaWalletGate, state)

  return null
}

export const SolanaWalletShell = () => {
  const endpoint = useMemo(() => clusterApiUrl('mainnet-beta'), [])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <SolanaWalletUiStyle />
          <SolanaWalletBridge />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}

const SolanaWalletUiStyle = createGlobalStyle`
  .wallet-adapter-modal-wrapper {
    background: var(--white);
    box-shadow: var(--shadow-4);
    font-family: 'Inter', sans-serif;
  }

  .wallet-adapter-modal-title {
    color: var(--ds-primary);
  }

  .wallet-adapter-modal-button-close {
    background: var(--ds-secondary);
  }

  .wallet-adapter-modal-button-close svg {
    fill: var(--muted);
  }

  .wallet-adapter-modal-button-close:hover svg {
    fill: var(--ds-primary);
  }

  .wallet-adapter-modal-wrapper .wallet-adapter-button {
    color: var(--ds-primary);
  }

  .wallet-adapter-modal-wrapper .wallet-adapter-button:not([disabled]):hover {
    background-color: rgba(28, 32, 36, 0.06);
  }

  .wallet-adapter-modal-list .wallet-adapter-button span {
    color: var(--muted);
    opacity: 1;
  }

  .wallet-adapter-modal-list-more {
    color: var(--ds-primary);
  }

  .wallet-adapter-modal-list-more svg {
    fill: var(--ds-primary);
  }

  .wallet-adapter-modal-middle-button {
    background-color: var(--ds-accent-9);
    color: var(--white);
  }

  .wallet-adapter-modal-middle-button:hover {
    background-color: var(--accent-10);
  }
`
