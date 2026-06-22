import { createAppKit } from '@reown/appkit'
import { mainnet, solana, solanaTestnet } from '@reown/appkit/networks'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'

export const reownProvider = createAppKit({
  adapters: [new EthersAdapter()],
  networks: [mainnet, solana, solanaTestnet],
  projectId: import.meta.env.VITE_WC_PROJECT_ID,
  features: { analytics: false },
  themeMode: 'light',
  featuredWalletIds: [],
})

export type ReownProvider = typeof reownProvider
