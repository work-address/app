import { BrowserProvider } from 'ethers'

import { ethConnected, ethConnectError, ethDisconnected } from './eth.model'
import {
  solanaConnected,
  solanaConnectError,
  solanaDisconnected,
} from './solana.model'

import { reownProvider } from '@/shared'

/**
 * Unified Reown event handler — routes connect/disconnect events
 * to the correct chain model (ETH or Solana) based on namespace.
 */
const unsubscribeReownEvents = reownProvider.subscribeEvents(async (event) => {
  if (event.data.event === 'CONNECT_SUCCESS') {
    const caipAddress = reownProvider.getCaipAddress()
    const isSolana = caipAddress?.startsWith('solana:')
    const isEvm = caipAddress?.startsWith('eip155:')

    if (isSolana) {
      const address = reownProvider.getAddress()

      if (address) {
        solanaConnected({ address })
      }
    } else if (isEvm) {
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
    solanaConnectError()
  } else if (event.data.event === 'DISCONNECT_SUCCESS') {
    ethDisconnected()
    solanaDisconnected()
  }
})

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unsubscribeReownEvents?.()
  })
}
