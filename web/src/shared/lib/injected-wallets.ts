/** The part of an EIP-1193 provider that signing a message needs. */
export type InjectedProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

/** A wallet the browser itself offers, such as MetaMask or Trust Wallet. */
export type InjectedWallet = {
  id: string
  name: string
  provider: InjectedProvider
}

type AnnounceEvent = Event & {
  detail?: {
    info?: { uuid?: string; name?: string }
    provider?: InjectedProvider
  }
}

const ANNOUNCE_WAIT_MS = 150

/**
 * Asks the browser's wallets to announce themselves (EIP-6963), which needs no
 * outside service and so works on a closed network too. A wallet too old to
 * announce itself can still be found as `window.ethereum`.
 */
export const findInjectedWallets = (): Promise<InjectedWallet[]> =>
  new Promise((resolve) => {
    const wallets = new Map<string, InjectedWallet>()

    const onAnnounce = (event: Event) => {
      const { info, provider } = (event as AnnounceEvent).detail ?? {}

      if (info?.uuid && provider) {
        wallets.set(info.uuid, {
          id: info.uuid,
          name: info.name || 'Wallet',
          provider,
        })
      }
    }

    window.addEventListener('eip6963:announceProvider', onAnnounce)
    window.dispatchEvent(new Event('eip6963:requestProvider'))

    window.setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce)

      const legacy = (window as Window & { ethereum?: InjectedProvider })
        .ethereum

      if (wallets.size === 0 && legacy) {
        wallets.set('injected', {
          id: 'injected',
          name: 'Wallet',
          provider: legacy,
        })
      }

      resolve([...wallets.values()])
    }, ANNOUNCE_WAIT_MS)
  })
