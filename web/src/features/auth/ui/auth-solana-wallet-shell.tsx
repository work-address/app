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
import { useMemo, memo } from 'react'
import { createGlobalStyle } from 'styled-components'

import type { SolanaWalletState } from '@/entities/profile'

import { SolanaWalletGate } from '@/entities/profile'

import '@solana/wallet-adapter-react-ui/styles.css'

export const AuthSolanaWalletShell = memo(() => {
  const endpoint = useMemo(() => clusterApiUrl('mainnet-beta'), [])

  const wallets = useMemo(() => [], [])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <SolanaWalletUiStyle />
          <SolanaWalletBridge />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
})

const SolanaWalletBridge = memo(() => {
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
})

const SolanaWalletUiStyle = createGlobalStyle`
  .wallet-adapter-modal-wrapper {
    font-family: 'Inter', sans-serif;
  }
`
