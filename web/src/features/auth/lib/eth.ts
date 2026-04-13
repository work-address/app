import { createAppKit } from '@reown/appkit'
import { mainnet } from '@reown/appkit/networks'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'

export const ethUI = createAppKit({
  adapters: [new EthersAdapter()],
  networks: [mainnet],
  projectId: import.meta.env.VITE_WC_PROJECT_ID,
  features: { analytics: false },
})

ethUI.setThemeMode('light')
