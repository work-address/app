import { createEffect, createEvent, createStore, sample } from 'effector'

import { reownProvider } from '@/shared'

export type SolanaModalResult = {
  address: string
}

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

export const openSolanaModalFx = createEffect(async () => {
  await reownProvider.open({
    namespace: 'solana',
  })
})

export const disconnectSolanaFx = createEffect(async () => {
  await reownProvider.disconnect()
})
