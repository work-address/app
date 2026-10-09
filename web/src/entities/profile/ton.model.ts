import { createEffect, createEvent } from 'effector'

import type { AuthorizationHeaders, TonAuthSuccessPayload } from './types'

import { baseApi, getTonProvider, getLoadedTonProvider, runApi } from '@/shared'

export const tonAuthSuccess = createEvent<TonAuthSuccessPayload>()

export const tonDisconnected = createEvent()

export const tonAuthError = createEvent()

export const openTonModalFx = createEffect(
  async (params: { nonce: string }) => {
    const tonConnectProvider = await getTonProvider()
    await subscribeTonUiEventsFx()

    tonConnectProvider.setConnectRequestParameters({
      value: {
        tonProof: params.nonce,
      },
      state: 'ready',
    })

    await tonConnectProvider.openModal()
  },
)

export const loginTonFx = createEffect(
  async (params: TonAuthSuccessPayload): Promise<AuthorizationHeaders> => {
    const result = await runApi(() =>
      baseApi.authControllerCheckProofHandler({
        body: params,
      }),
    )

    return {
      authorization: result.headers['authorization'],
      refreshToken: result.headers['refresh-token'],
    }
  },
)

export const disconnectTonFx = createEffect(async () => {
  await getLoadedTonProvider()?.disconnect()
})

let subscription: Promise<() => void> | null = null

export const subscribeTonUiEventsFx = createEffect(async () => {
  subscription ??= getTonProvider()
    .then((tonConnectProvider) =>
      tonConnectProvider.onStatusChange((wallet) => {
        const proofItemReply = wallet?.connectItems?.tonProof

        if (
          proofItemReply &&
          'proof' in proofItemReply &&
          wallet &&
          wallet.account.publicKey
        ) {
          return tonAuthSuccess({
            address: wallet.account.address,
            network: wallet.account.chain,
            public_key: wallet.account.publicKey,
            proof: {
              ...proofItemReply.proof,
              state_init: wallet.account.walletStateInit,
            },
          })
        } else if (!wallet) {
          tonDisconnected()
        }
      }),
    )
    .catch((error) => {
      subscription = null
      throw error
    })
  return subscription
})
