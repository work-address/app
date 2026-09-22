import '@nomicfoundation/hardhat-ethers'
import '@nomicfoundation/hardhat-chai-matchers'

import { formatUnits } from 'ethers'
import { subtask, task } from 'hardhat/config'
import { HardhatPluginError } from 'hardhat/plugins'
import { TASK_NODE_SERVER_READY } from 'hardhat/builtin-tasks/task-names'

import type { HardhatUserConfig } from 'hardhat/config'

import { runDeploy, runDryRun, sepoliaNetwork } from './scripts/deploy-command'
import { runOfficialManifest } from './scripts/official-manifest'
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
 * `hardhat` (in process) and `localhost` (a `hardhat node`, `pnpm run node`)
 * are the local chain, 31337. Their chain id is pinned, so Hardhat refuses
 * the connection if that URL ever answers as another chain, and every script
 * in scripts/ checks for 31337 again before sending anything.
 *
 * `sepolia` is the testnet pilot (SPEC §14; DEC-09 settles on Ethereum, and
 * Sepolia has no official Tether, so its token is the mock). Its URL and
 * deployer key are read from SEPOLIA_RPC_URL and DEPLOYER_KEY in the
 * environment of whoever deploys, and nothing in this repository sets
 * either. Even with both set, `deploy:contracts` refuses it unless the
 * command also carries `--confirm-chain-id 11155111`. There is no mainnet
 * entry: chain 1 is refused by every script, with or without a flag.
 */
const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun' },
  },
  networks: {
    hardhat: { chainId: LOCAL_CHAIN_ID },
    localhost: { url: LOCAL_RPC_URL, chainId: LOCAL_CHAIN_ID },
    sepolia: sepoliaNetwork(process.env),
  },
}

// An idle node keeps mining, so the latest block's time tracks the clock.
subtask(TASK_NODE_SERVER_READY).setAction(async (args, _hre, runSuper) => {
  await runSuper(args)
  await enableIntervalMining(args.provider)
  console.log('Interval mining: a block every 5 s, so chain time keeps moving while idle.\n')
})

/** A refusal is the answer, not a crash: Hardhat prints a plugin error's message without a stack. */
async function refusalsAsMessages(action: () => Promise<unknown>): Promise<void> {
  try {
    await action()
  } catch (error) {
    throw new HardhatPluginError('@work-address/contracts', (error as Error).message, error as Error)
  }
}

task('deploy:contracts', 'Deploys the test USDT, MarketplaceEscrow and IdentityRegistry and writes deployments/<network>.json')
  .addOptionalParam(
    'confirmChainId',
    'Required for any chain but the local one (31337): the chain id the deploy is meant for. Chain 1 is refused regardless.',
  )
  .setAction(async ({ confirmChainId }, hre) => {
    await refusalsAsMessages(() => runDeploy(hre, { confirmChainId }))
  })

task('deploy:dry-run', 'Rehearses the deploy on an in-process fork of a network; sends that network nothing')
  .addOptionalParam('forkUrl', 'RPC endpoint of the network to fork (default: DRY_RUN_FORK_URL)')
  .addOptionalParam('block', 'Block to fork at (default: the latest, recorded in the manifest)')
  .addOptionalParam('deployer', "The real deployer's address, to predict the addresses (default: DEPLOYER_ADDRESS)")
  .setAction(async ({ forkUrl, block, deployer }, hre) => {
    await refusalsAsMessages(() => runDryRun(hre, { forkUrl, block, deployer }))
  })

task('official:manifest', 'Builds deployments/official.json, the signed allowlist of official deployments')
  .addParam('publisher', "The publisher's address. Its key signs in the publisher's own wallet, never here")
  .addOptionalParam('deployments', 'Comma-separated deployment manifests to vouch for (default: deployments/sepolia.json)')
  .addOptionalParam('issuedAt', 'Unix seconds, signed with the list; pass the printed value back with --signature')
  .addOptionalParam('release', 'The contracts release (default: contracts-<package version>)')
  .addOptionalParam('signature', "The publisher's eth_signTypedData_v4 signature over the printed request")
  .addOptionalParam('out', 'Where to write it (default: deployments/official.json)')
  .addFlag('signLocally', 'Local chain only: the node signs as --publisher, one of its own public test accounts')
  .setAction(async ({ publisher, deployments, issuedAt, release, signature, out, signLocally }, hre) => {
    const files = ((deployments as string | undefined) ?? manifestPath('sepolia'))
      .split(',')
      .map((file) => file.trim())
      .filter((file) => file !== '')

    await refusalsAsMessages(() =>
      runOfficialManifest(hre, { deployments: files, publisher, issuedAt, release, signature, out, signLocally }),
    )
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
