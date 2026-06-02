import { BrowserProvider } from 'ethers'

type ReownProvider = Awaited<ReturnType<typeof createReownProvider>>

let providerPromise: Promise<ReownProvider> | null = null
let unsubscribeReownEvents: (() => void) | undefined

async function createReownProvider() {
  const [{ createAppKit }, { mainnet }, { EthersAdapter }] = await Promise.all([
    import('@reown/appkit'),
    import('@reown/appkit/networks'),
    import('@reown/appkit-adapter-ethers'),
  ])

  return createAppKit({
    adapters: [new EthersAdapter()],
    networks: [mainnet],
    projectId: import.meta.env.VITE_WC_PROJECT_ID,
    features: {
      analytics: false,
      swaps: false,
      onramp: false,
      email: false,
      socials: false,
    },
    enableWalletGuide: false,
    themeMode: 'light',
    featuredWalletIds: [],
  })
}

async function subscribeReownEvents(reownProvider: ReownProvider) {
  const { ethConnected, ethConnectError, ethDisconnected } = await import(
    '@/entities/profile/eth.model'
  )

  return reownProvider.subscribeEvents(async (event) => {
    if (event.data.event === 'CONNECT_SUCCESS') {
      const caipAddress = reownProvider.getCaipAddress()
      const isEvm = caipAddress?.startsWith('eip155:')

      if (isEvm) {
        const walletProvider = reownProvider.getWalletProvider()

        if (walletProvider) {
          const ethersProvider = new BrowserProvider(walletProvider as never)
          const signer = await ethersProvider.getSigner()
          const address = await signer.getAddress()
          ethConnected({ signer, address, ethersProvider })
        }
      }
    } else if (event.data.event === 'CONNECT_ERROR') {
      ethConnectError()
    } else if (event.data.event === 'DISCONNECT_SUCCESS') {
      ethDisconnected()
    }
  })
}

export async function getReownProvider() {
  if (!providerPromise) {
    providerPromise = createReownProvider().then(async (provider) => {
      unsubscribeReownEvents = await subscribeReownEvents(provider)
      return provider
    })
  }

  return providerPromise
}

export async function disconnectReownProvider() {
  if (!providerPromise) {
    return
  }

  const reownProvider = await providerPromise
  await reownProvider.disconnect()
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unsubscribeReownEvents?.()
    providerPromise = null
  })
}
