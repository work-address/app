import type { ReownProvider } from './reown-provider'
import type { BrowserProvider } from 'ethers'

let reown: ReownProvider | null = null
let initialization: Promise<ReownProvider> | null = null

export const getReownProvider = async (): Promise<ReownProvider> => {
  initialization ??= import('./reown-provider')
    .then((module) => {
      reown = module.reownProvider
      return reown
    })
    .catch((error) => {
      initialization = null
      throw error
    })
  return initialization
}

export const getLoadedReownProvider = () => reown

let browserProvider: typeof BrowserProvider | null = null

export const getBrowserProvider = async (): Promise<typeof BrowserProvider> => {
  if (!browserProvider) {
    browserProvider = (await import('ethers').then(
      (m) => m.BrowserProvider,
    )) as typeof BrowserProvider
  }

  return browserProvider
}
