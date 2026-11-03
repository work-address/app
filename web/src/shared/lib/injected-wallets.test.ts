import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { findInjectedWallets } from './injected-wallets'

const provider = { request: () => Promise.resolve(null) }

describe('findInjectedWallets', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'window',
      Object.assign(new EventTarget(), { setTimeout: globalThis.setTimeout }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('collects the wallets that announce themselves', async () => {
    const announce = () =>
      window.dispatchEvent(
        Object.assign(new Event('eip6963:announceProvider'), {
          detail: { info: { uuid: 'a', name: 'MetaMask' }, provider },
        }),
      )

    window.addEventListener('eip6963:requestProvider', announce, { once: true })

    expect(await findInjectedWallets()).toEqual([
      { id: 'a', name: 'MetaMask', provider },
    ])
  })

  it('falls back to window.ethereum for an older wallet', async () => {
    Object.assign(window, { ethereum: provider })

    expect(await findInjectedWallets()).toEqual([
      { id: 'injected', name: 'Wallet', provider },
    ])
  })

  it('finds nothing in a browser with no wallet', async () => {
    expect(await findInjectedWallets()).toEqual([])
  })
})
