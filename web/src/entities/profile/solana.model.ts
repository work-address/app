import { AxiosError } from 'axios'
import {
  attach,
  createEffect,
  createEvent,
  createStore,
  sample,
  combine,
} from 'effector'
import { createGate } from 'effector-react'

import type {
  AuthorizationHeaders,
  SolanaWalletState,
  SolanaModalResult,
} from './types.ts'

import { baseApi } from '@/shared'

export const SolanaWalletGate =
  createGate<SolanaWalletState>('SolanaWalletGate')

export const requestSolanaWalletMount = createEvent()

export const $solanaWalletMountRequested = createStore(false).on(
  requestSolanaWalletMount,
  () => true,
)

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
const disconnectSolana = createEvent()

export const $solanaConnectionStatus = createStore<
  'connected' | 'disconnected'
>('disconnected')
  .on(solanaConnectedPub, () => 'connected')
  .on(solanaDisconnectedPub, () => 'disconnected')

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

/** Resolves once the lazily-mounted Solana shell has opened the gate. */
function whenSolanaWalletReady() {
  if (SolanaWalletGate.status.getState()) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    const unwatch = SolanaWalletGate.status.watch((opened) => {
      if (opened) {
        unwatch()
        resolve()
      }
    })
  })
}

export const openSolanaModalFx = createEffect(async () => {
  await whenSolanaWalletReady()
})

sample({
  clock: openSolanaModalFx,
  target: requestSolanaWalletMount,
})

sample({
  clock: openSolanaModalFx,
  source: $solanaWallet,
}).watch((solanaWallet) => {
  solanaWallet.openModal(true)
})

sample({
  clock: disconnectSolana,
  source: combine($solanaWallet, SolanaWalletGate.status),
}).watch(([solanaWallet, solanaWalletGateStatus]) => {
  if (solanaWalletGateStatus) {
    solanaWallet.disconnect()
  }
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
    const result = await baseApi.authControllerLoginSolana({
      body: {
        signature: params.signature,
        address: params.address,
      },
    })

    if (result instanceof AxiosError) {
      throw result
    }

    return {
      authorization: result.headers['authorization'],
      refreshToken: result.headers['refresh-token'],
    }
  },
)
