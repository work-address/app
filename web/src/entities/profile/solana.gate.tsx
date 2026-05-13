import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { sample } from 'effector'
import { createGate, useGate } from 'effector-react'
import { useMemo } from 'react'

import {
  $solanaWallet,
  solanaConnected,
  solanaDisconnected,
} from './solana.model'

import type { SolanaWalletState } from './solana.model'

export const SolanaWalletGate =
  createGate<SolanaWalletState>('SolanaWalletGate')

sample({
  clock: SolanaWalletGate.state.updates,
  target: $solanaWallet,
})

sample({
  clock: SolanaWalletGate.state.updates,
  filter: (s) => s.connected && s.publicKey !== null,
  fn: (s) => ({ address: s.publicKey!.toBase58() }),
  target: solanaConnected,
})

sample({
  clock: SolanaWalletGate.state.updates,
  filter: (s) => !s.connected,
  target: solanaDisconnected,
})

export const SolanaWalletBridge = () => {
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
