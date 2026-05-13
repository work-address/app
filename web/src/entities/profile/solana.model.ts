import {
  attach,
  createEffect,
  createEvent,
  createStore,
  sample,
} from 'effector'
import { nanoid } from 'nanoid'

import type { PublicKey } from '@solana/web3.js'

export type SolanaWalletState = {
  publicKey: PublicKey | null
  signMessage: ((message: Uint8Array) => Promise<Uint8Array>) | undefined
  disconnect: () => Promise<void>
  openModal: (visible: boolean) => void
  connected: boolean
}

export type SolanaModalResult = {
  address: string
}

export const $solanaWallet = createStore<SolanaWalletState>({
  publicKey: null,
  signMessage: undefined,
  disconnect: async () => {},
  openModal: () => {},
  connected: false,
})

export const solanaConnected = createEvent<SolanaModalResult>()
export const solanaConnectedPub = createEvent<SolanaModalResult>()
export const solanaDisconnected = createEvent()
export const solanaDisconnectedPub = createEvent()
export const solanaConnectError = createEvent()

export const $solanaConnectionStatus = createStore<
  'connected' | 'disconnected'
>('disconnected')
  .on(solanaConnectedPub, () => 'connected')
  .on(solanaDisconnectedPub, () => 'disconnected')

sample({
  clock: solanaConnected,
  source: $solanaConnectionStatus,
  filter: (status) => status === 'disconnected',
  fn: (_, data) => data,
  target: solanaConnectedPub,
})

sample({
  clock: solanaDisconnected,
  source: $solanaConnectionStatus,
  filter: (status) => status === 'connected',
  target: solanaDisconnectedPub,
})

export const openSolanaModalFx = attach({
  source: $solanaWallet,
  effect: (wallet) => {
    wallet.openModal(true)
  },
})

export const disconnectSolanaFx = attach({
  source: $solanaWallet,
  effect: async (wallet) => {
    await wallet.disconnect()
  },
})

export const getNonceSolanaFx = createEffect((): string => {
  return nanoid()
})

export const signSolanaFx = attach({
  source: $solanaWallet,
  effect: async (
    wallet,
    nonce: string,
  ): Promise<{ signature: string; address: string; nonce: string }> => {
    if (!wallet.signMessage || !wallet.publicKey) {
      throw new Error(
        'Solana wallet is not connected or does not support signMessage',
      )
    }

    const encoded = new TextEncoder().encode(nonce)
    const signatureBytes = await wallet.signMessage(encoded)
    const signature = btoa(String.fromCharCode(...signatureBytes))

    return { signature, address: wallet.publicKey.toBase58(), nonce }
  },
})

export const loginSolanaFx = createEffect(
  async (_: { signature: string; address: string; nonce: string }) => {
    // TODO: replace with real API call once backend is ready
    // POST /api/auth/solana/verify → { address, signature, nonce } → { token: string }
    throw new Error('Solana login backend not ready yet')
  },
)
