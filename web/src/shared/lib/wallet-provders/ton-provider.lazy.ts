import type { TonConnectUI } from '@tonconnect/ui'

let tonProvider: TonConnectUI | null = null

export const getTonProvider = async () => {
  if (!tonProvider) {
    tonProvider = (await import('./ton-provider').then(
      (m) => m.tonConnectProvider,
    )) as TonConnectUI
  }

  return tonProvider
}
