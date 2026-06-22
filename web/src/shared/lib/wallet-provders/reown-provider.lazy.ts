import type { ReownProvider } from './reown-provider'
import type { BrowserProvider } from 'ethers'

let reown: ReownProvider | null = null

export const getReownProvider = async (): Promise<ReownProvider> => {
  if (!reown) {
    reown = (await import('./reown-provider.ts').then(
      (m) => m.reownProvider,
    )) as ReownProvider
  }

  return reown
}

let browserProvider: typeof BrowserProvider | null = null

export const getBrowserProvider = async (): Promise<typeof BrowserProvider> => {
  if (!browserProvider) {
    browserProvider = (await import('ethers').then(
      (m) => m.BrowserProvider,
    )) as typeof BrowserProvider
  }

  return browserProvider
}
