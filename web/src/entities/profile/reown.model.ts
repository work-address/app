import { BrowserProvider } from 'ethers'

import { ethConnected, ethConnectError, ethDisconnected } from './eth.model'

import { reownProvider } from '@/shared'

/**
 * Reown event handler for ETH (eip155) only.
 * Solana is handled by the native wallet adapter via SolanaWalletGate.
 */
const unsubscribeReownEvents = reownProvider.subscribeEvents(async (event) => {
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

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unsubscribeReownEvents?.()
  })
}
