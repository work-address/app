import '@nomicfoundation/hardhat-ethers'
import '@nomicfoundation/hardhat-chai-matchers'

import type { HardhatUserConfig } from 'hardhat/config'

/**
 * Local development and tests only. There is deliberately no public network
 * here: nothing in this package is reviewed for real funds, and a testnet
 * pilot adds its network after the chain and asset decisions (DEC-09).
 */
const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun' },
  },
}

export default config
