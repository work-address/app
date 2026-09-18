import '@nomicfoundation/hardhat-ethers'
import '@nomicfoundation/hardhat-chai-matchers'

import { formatUnits } from 'ethers'
import { subtask, task } from 'hardhat/config'
import { TASK_NODE_SERVER_READY } from 'hardhat/builtin-tasks/task-names'

import type { HardhatUserConfig } from 'hardhat/config'

import {
  LOCAL_CHAIN_ID,
  LOCAL_RPC_URL,
  enableIntervalMining,
  manifestPath,
} from './scripts/local-chain'
import { mintLocal } from './scripts/mint'
import { advanceTime, parseDuration } from './scripts/time-advance'
import { runWalkthrough } from './scripts/walkthrough'

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

task('mint', 'Mints local test USDT to an address, and tops up its gas')
  .addPositionalParam('to', 'Recipient address')
  .addPositionalParam('amount', 'Whole USDT, e.g. 1000')
  .addOptionalParam('manifest', 'Deployment manifest (default: deployments/<network>.json)')
  .setAction(async ({ to, amount, manifest }, hre) => {
    const result = await mintLocal(hre, {
      to,
      amount,
      manifest: manifest ?? manifestPath(hre.network.name),
    })

    console.log(
      `Minted ${formatUnits(result.minted, 6)} USDT to ${result.to}; ` +
        `balance ${formatUnits(result.balance, 6)} USDT` +
        (result.gasToppedUp ? '; gas topped up to 10 ETH' : ''),
    )
  })

task('time:advance', 'Moves the local chain clock forward and mines a block')
  .addPositionalParam('duration', 'Seconds, or a number with s, m, h or d: 90, 72h, 8d')
  .setAction(async ({ duration }, hre) => {
    const { before, after } = await advanceTime(hre, parseDuration(duration))

    console.log(
      `Block ${before.number} at ${new Date(before.timestamp * 1000).toISOString()} -> ` +
        `block ${after.number} at ${new Date(after.timestamp * 1000).toISOString()}`,
    )
  })

task('walkthrough', 'Funds, submits, releases and refunds one allocation on the local deployment')
  .addOptionalParam('manifest', 'Deployment manifest (default: deployments/<network>.json)')
  .setAction(async ({ manifest }, hre) => {
    await runWalkthrough(hre, { manifest: manifest ?? manifestPath(hre.network.name) })
  })

export default config
