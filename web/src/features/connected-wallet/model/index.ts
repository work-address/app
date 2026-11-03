import { createEffect, sample } from 'effector'

import { fetchStatusFx } from '@/entities/profile'
import { baseApi, runApi, runApiData, type InjectedWallet } from '@/shared'

/** Whatever can prove it holds a wallet: a browser wallet or an injected one. */
type WalletSigner = {
  address?: string
  getAddress?: () => Promise<string>
  signMessage: (message: string) => Promise<string>
}

/**
 * A Google account proves a wallet is its own by signing a message the API
 * issued for that purpose. The wallet then shows on the profile and is what
 * invoices get paid to; it signs nobody in and grants no access.
 */
export const connectWalletFx = createEffect(async (signer: WalletSigner) => {
  const address = signer.address ?? (await signer.getAddress?.())

  if (!address) {
    throw new Error('The wallet did not give an address')
  }

  const message = await runApiData(() =>
    baseApi.userControllerConnectedWalletNonce({ body: { address } }),
  )
  const signature = await signer.signMessage(message as string)

  await runApi(() =>
    baseApi.userControllerConnectWallet({ body: { address, signature } }),
  )
})

export const connectInjectedWalletFx = createEffect(
  async ({ provider }: InjectedWallet) => {
    const { BrowserProvider } = await import('ethers')
    const signer = await new BrowserProvider(provider).getSigner()

    await connectWalletFx(signer)
  },
)

export const disconnectWalletFx = createEffect(() =>
  runApi(() => baseApi.userControllerDisconnectWallet()),
)

sample({
  clock: [connectWalletFx.done, disconnectWalletFx.done],
  target: fetchStatusFx,
})
