import '@nomicfoundation/hardhat-ethers'
import '@nomicfoundation/hardhat-chai-matchers'

import { subtask } from 'hardhat/config'
import { TASK_NODE_SERVER_READY } from 'hardhat/builtin-tasks/task-names'

import type { HardhatUserConfig } from 'hardhat/config'

import { LOCAL_CHAIN_ID, LOCAL_RPC_URL, enableIntervalMining } from './scripts/local-chain'

/**
 * Local development and tests only. There is deliberately no public network
 * here: nothing in this package is reviewed for real funds, and a testnet
 * pilot adds its network after the chain and asset decisions (DEC-09).
 *
 * `localhost` is a `hardhat node` (`npm run node`). Its chain id is pinned, so
 * Hardhat refuses the connection if that URL ever answers as another chain,
 * and every script in scripts/ checks for 31337 again before sending anything.
 */
const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun' },
  },
  networks: {
    hardhat: { chainId: LOCAL_CHAIN_ID },
    localhost: { url: LOCAL_RPC_URL, chainId: LOCAL_CHAIN_ID },
  },
}

// An idle node keeps mining, so the latest block's time tracks the clock.
subtask(TASK_NODE_SERVER_READY).setAction(async (args, _hre, runSuper) => {
  await runSuper(args)
  await enableIntervalMining(args.provider)
  console.log('Interval mining: a block every 5 s, so chain time keeps moving while idle.\n')
})

export default config
