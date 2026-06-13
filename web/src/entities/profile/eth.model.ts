import { AxiosError } from 'axios'
import { createEffect, createEvent, createStore, sample } from 'effector'

import type { AuthorizationHeaders, EthModalResult } from './types.ts'

import { baseApi, disconnectReownProvider, getReownProvider } from '@/shared'

export type EthModalResult = {
  signer: JsonRpcSigner
  address: string
  ethersProvider: BrowserProvider
}

export const ethConnected = createEvent<EthModalResult>()

export const ethConnectedPub = createEvent<EthModalResult>()

export const ethDisconnected = createEvent()

export const ethDisconnectedPub = createEvent()

export const ethConnectError = createEvent()

export const $ethConnectionStatus = createStore<'connected' | 'disconnected'>(
  'disconnected',
)
  .on(ethConnectedPub, () => 'connected')
  .on(ethDisconnectedPub, () => 'disconnected')

sample({
  clock: ethConnected,
  source: $ethConnectionStatus,
  filter: (status) => status === 'disconnected',
  fn: (_, data) => data,
  target: ethConnectedPub,
})

sample({
  clock: ethDisconnected,
  source: $ethConnectionStatus,
  filter: (status) => status === 'connected',
  target: ethDisconnectedPub,
})

export const openEthModalFx = createEffect(async () => {
  const reownProvider = await getReownProvider()
  await reownProvider.open({ namespace: 'eip155' })
})

export const signEthFx = createEffect(
  async (params: { signer?: EthModalResult['signer']; nonce: string }) => {
    if (!params.signer) {
      throw new Error('Signer is null. Check the provider data exists.')
    }

    return params.signer.signMessage(params.nonce)
  },
)

export const disconnectEthFx = createEffect(async () => {
  await disconnectReownProvider()
})

export const loginEthFx = createEffect(
  async (params: {
    signature: string
    address: string
  }): Promise<AuthorizationHeaders> => {
    const result = await baseApi.authControllerLoginEth({
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
