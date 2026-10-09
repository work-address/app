import {
  attach,
  createEffect,
  createEvent,
  createStore,
  sample,
} from 'effector'
import { createGate } from 'effector-react'

import type {
  AuthorizationHeaders,
  SolanaWalletState,
  SolanaModalResult,
} from './types'

import { baseApi, runApi } from '@/shared'

export const SolanaWalletGate =
  createGate<SolanaWalletState>('SolanaWalletGate')

export const toggleSolanaModalMounted = createEvent()
export const solanaWalletLoadFailed = createEvent<Error>()

export const $solanaWalletMounted = createStore(false)
  .on(toggleSolanaModalMounted, () => true)
  .reset(solanaWalletLoadFailed)

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

export const openSolanaModalFx = attach({
  source: { wallet: $solanaWallet, ready: SolanaWalletGate.status },
  effect: async ({ wallet, ready }) => {
    if (ready) {
      wallet.openModal(true)
      return
    }

    // Subscribe before requesting the lazy shell so the first click is kept.
    const loadedWallet = new Promise<SolanaWalletState>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout)
        stopReady()
        stopFailure()
      }
      const stopReady = SolanaWalletGate.open.watch((state) => {
        cleanup()
        resolve(state)
      })
      const stopFailure = solanaWalletLoadFailed.watch((error) => {
        cleanup()
        reject(error)
      })
      const timeout = setTimeout(() => {
        cleanup()
        solanaWalletLoadFailed(new Error('Wallet load timed out'))
        reject(new Error('Wallet load timed out'))
      }, 15_000)
    })
    toggleSolanaModalMounted()
    ;(await loadedWallet).openModal(true)
  },
})

export const disconnectSolanaFx = attach({
  source: $solanaWallet,
  effect: async (solanaWallet) => {
    if (solanaWallet.connected) {
      await solanaWallet.disconnect()
    }
  },
})

sample({
  clock: SolanaWalletGate.state.updates,
  target: $solanaWallet,
})

sample({
  clock: SolanaWalletGate.state.updates,
  filter: (state) => state.connected && state.publicKey !== null,
  fn: (state) => ({ address: state.publicKey?.toBase58() ?? '' }),
  target: solanaConnected,
})

sample({
  clock: SolanaWalletGate.state.updates,
  filter: (state) => !state.connected,
  target: solanaDisconnected,
})

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

export const signSolanaFx = attach({
  source: $solanaWallet,
  effect: async (
    wallet,
    nonce: string,
  ): Promise<{ signature: string; address: string }> => {
    if (!wallet.signMessage || !wallet.publicKey) {
      throw new Error(
        'Solana wallet is not connected or does not support signMessage',
      )
    }

    const encoded = new TextEncoder().encode(nonce)
    const signatureBytes = await wallet.signMessage(encoded)
    const signature = btoa(String.fromCharCode(...signatureBytes))

    return { signature, address: wallet.publicKey.toBase58() }
  },
})

export const loginSolanaFx = createEffect(
  async (params: {
    signature: string
    address: string
  }): Promise<AuthorizationHeaders> => {
    const result = await runApi(() =>
      baseApi.authControllerLoginSolana({
        body: {
          signature: params.signature,
          address: params.address,
        },
      }),
    )

    return {
      authorization: result.headers['authorization'],
      refreshToken: result.headers['refresh-token'],
    }
  },
)
