import { AxiosError } from 'axios'
import { createEffect, createEvent } from 'effector'
import { BrowserProvider } from 'ethers'

import { ethUI } from '../lib'

import type { AuthorizationHeaders } from './types.ts'
import type { JsonRpcSigner } from 'ethers'

import { baseApi } from '@/features/shared'

export type EthModalResult = {
  signer: JsonRpcSigner
  address: string
  ethersProvider: BrowserProvider
}

export const ethConnected = createEvent<EthModalResult>()

export const ethConnectError = createEvent()

export const ethDisconnected = createEvent()

export const openEthModalFx = createEffect(async () => {
  await ethUI.open()
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
  await ethUI.disconnect()
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

let connected = false

ethUI.subscribeEvents(async (event) => {
  if (
    event.data.event === 'CONNECT_SUCCESS' &&
    event.data.properties.view === 'Connect' &&
    !connected
  ) {
    connected = true
    const walletProvider = ethUI.getWalletProvider()

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
  } else if (event.data.event === 'DISCONNECT_SUCCESS' && connected) {
    connected = false
    ethDisconnected()
  }
})
