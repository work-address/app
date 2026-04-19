import { AxiosError } from 'axios'
import { createEffect, createEvent } from 'effector'

import type { AuthorizationHeaders } from './types.ts'
import type { TonProofItemReplySuccess } from '@/features/shared'

import { baseApi, tonConnectProvider } from '@/features/shared'

type TonAuthSuccessPayload = {
  address: string
  network: string
  public_key: string
  proof: TonProofItemReplySuccess['proof']
}

export const tonAuthSuccess = createEvent<TonAuthSuccessPayload>()

export const tonDisconnected = createEvent()

export const tonAuthError = createEvent()

export const openTonModalFx = createEffect(
  async (params: { nonce: string }) => {
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
    const result = await baseApi.authControllerCheckProofHandler({
      body: params,
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

export const disconnectTonFx = createEffect(async () => {
  await tonConnectProvider.disconnect()
})

const unsubscribeTonUI = tonConnectProvider.onStatusChange((wallet) => {
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
      proof: proofItemReply.proof,
    })
  } else if (!wallet) {
    tonDisconnected()
  }
})

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unsubscribeTonUI?.()
  })
}
