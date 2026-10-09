import type { TonConnectUI } from '@tonconnect/ui'

let tonProvider: TonConnectUI | null = null
let initialization: Promise<TonConnectUI> | null = null

export const getTonProvider = async () => {
  initialization ??= import('./ton-provider')
    .then((module) => {
      tonProvider = module.tonConnectProvider
      return tonProvider
    })
    .catch((error) => {
      initialization = null
      throw error
    })
  return initialization
}

export const getLoadedTonProvider = () => tonProvider
