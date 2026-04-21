import { AxiosError } from 'axios'
import { createEffect, createEvent, createStore, sample } from 'effector'
import { BrowserProvider } from 'ethers'

import type { AuthorizationHeaders } from './types.ts'
import type { JsonRpcSigner } from 'ethers'

import { baseApi, reownEthProvider } from '@/features/shared'

export type EthModalResult = {
  signer: JsonRpcSigner
  address: string
  ethersProvider: BrowserProvider
}

const ethConnected = createEvent<EthModalResult>()

export const ethConnectedPub = createEvent<EthModalResult>()

const ethDisconnected = createEvent()

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
  await reownEthProvider.open()
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
  await reownEthProvider.disconnect()
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

const unsubscribeEthUI = reownEthProvider.subscribeEvents(async (event) => {
  if (
    event.data.event === 'CONNECT_SUCCESS' &&
    event.data.properties.view === 'Connect'
  ) {
    const walletProvider = reownEthProvider.getWalletProvider()

    if (!walletProvider) {
      // eslint-disable-next-line no-console
      return console.error(
        'Wallet is not connected. Check the ethUI resolve status.',
      )
    }

    const ethersProvider = new BrowserProvider(walletProvider as never)
    const signer = await ethersProvider.getSigner()
    const address = await signer.getAddress()

    ethConnected({ signer, address, ethersProvider })
  } else if (event.data.event === 'CONNECT_ERROR') {
    ethConnectError()
  } else if (event.data.event === 'DISCONNECT_SUCCESS') {
    ethDisconnected()
  }
})

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unsubscribeEthUI?.()
  })
}
