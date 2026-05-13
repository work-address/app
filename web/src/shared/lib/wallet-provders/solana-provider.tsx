import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { clusterApiUrl } from '@solana/web3.js'
import { useMemo, type ReactNode } from 'react'

import '@solana/wallet-adapter-react-ui/styles.css'

type Props = {
  children: ReactNode
}

export const SolanaWalletProvider = ({ children }: Props) => {
  const endpoint = useMemo(() => clusterApiUrl('mainnet-beta'), [])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
