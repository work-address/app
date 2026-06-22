import { AxiosError } from 'axios'
import { createEffect, createEvent } from 'effector'

import type { AuthorizationHeaders, TonAuthSuccessPayload } from './types.ts'

import { baseApi } from '@/shared'
import { getTonProvider } from '@/shared/lib/wallet-provders/ton-provider.lazy.ts'

type TonAuthSuccessPayload = {
  address: string
  network: string
  public_key: string
  proof: TonProofItemReplySuccess['proof'] & {
    state_init: string
  }
}

export const tonDisconnected = createEvent()

export const tonAuthError = createEvent<string>()

async function ensureTonWalletDisconnected() {
  try {
    await tonConnectProvider.disconnect()
  } catch {
    // Wallet was not connected.
  }

  if (!tonConnectProvider.connected) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup()
      reject(new Error('Timed out waiting for TON wallet to disconnect'))
    }, 10_000)

    const unsubscribe = tonConnectProvider.onStatusChange((wallet) => {
      if (!wallet) {
        cleanup()
        resolve()
      }
    })

    const cleanup = () => {
      window.clearTimeout(timeoutId)
      unsubscribe()
    }
  })
}

function extractTonAuthPayload(
  wallet: NonNullable<
    Awaited<ReturnType<typeof tonConnectProvider.connectWallet>>
  >,
): TonAuthSuccessPayload {
  const proofItemReply = wallet.connectItems?.tonProof

  if (!proofItemReply) {
    throw new Error('TON proof not received from wallet')
  }

  if ('error' in proofItemReply) {
    throw new Error(String(proofItemReply.error))
  }

  if (!wallet.account.publicKey) {
    throw new Error('TON wallet did not provide a public key')
  }

  if (!wallet.account.walletStateInit) {
    throw new Error('TON wallet did not provide wallet state init')
  }

  return {
    address: wallet.account.address,
    network: wallet.account.chain,
    public_key: wallet.account.publicKey,
    proof: {
      ...proofItemReply.proof,
      state_init: wallet.account.walletStateInit,
    },
  }
}

export const openTonModalFx = createEffect(
  async (params: { nonce: string }) => {
    const tonConnectProvider = await getTonProvider()

    tonConnectProvider.setConnectRequestParameters({
      value: {
        tonProof: params.nonce,
      },
      state: 'ready',
    })

    const wallet = await tonConnectProvider.connectWallet()

    return extractTonAuthPayload(wallet)
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
  await getTonProvider().then((ton) => ton.disconnect())
})

export const subscribeTonUiEventsFx = createEffect(async () => {
  const tonConnectProvider = await getTonProvider()

  return tonConnectProvider.onStatusChange((wallet) => {
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
  })
})
