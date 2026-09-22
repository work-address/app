import path from 'path'

import type { HardhatRuntimeEnvironment } from 'hardhat/types'

import {
  PUBLIC_TESTNETS,
  TEST_TOKENS,
  assertDeployTarget,
  deployContracts,
  dryRunDeploy,
  rolesFromEnv,
} from './deployment'
import {
  DEPLOYMENTS_DIR,
  deployLocal,
  escrowEnvLines,
  localAccountKey,
  manifestPath,
  writeManifest,
} from './local-chain'

import type { DeploymentManifest, TestToken } from './deployment'

/**
 * The public network entries of hardhat.config.ts. The URL and the deployer
 * key come from the environment of whoever runs the deploy, and from nowhere
 * else: nothing in the repository or its tests sets either, so without them
 * the entry has an empty URL and no account, and `deploy:contracts` refuses
 * it before a request is made.
 */
export function sepoliaNetwork(env: NodeJS.ProcessEnv): { url: string; chainId: number; accounts: string[] } {
  const key = (env.DEPLOYER_KEY ?? '').trim()

  return {
    url: (env.SEPOLIA_RPC_URL ?? '').trim(),
    chainId: 11155111,
    accounts: key === '' ? [] : [key],
  }
}

function tokenFrom(env: NodeJS.ProcessEnv): TestToken {
  const token = (env.LOCAL_TOKEN ?? 'TetherLikeUSDT') as TestToken

  if (!TEST_TOKENS.includes(token)) {
    throw new Error(`LOCAL_TOKEN must be ${TEST_TOKENS.join(' or ')}, not ${token}`)
  }

  return token
}

export type DeployCommandOptions = {
  /** `--confirm-chain-id`: the chain a public deploy is meant for. Never needed locally. */
  confirmChainId?: string
  env?: NodeJS.ProcessEnv
  log?: (line: string) => void
}

/**
 * `deploy:local`, `deploy:localhost` and `deploy:sepolia`. Asks the endpoint
 * for its chain id before anything else and holds it to the chain guard: the
 * local chain deploys from the node's own accounts, a confirmed testnet from
 * DEPLOYER_KEY with the roles FEE_RECIPIENT and ORIGIN_SIGNER_ADDRESS name,
 * and everything else stops there. The token is always a mock: there is no
 * official Tether on a testnet, and the manifest says so.
 */
export async function runDeploy(
  hre: HardhatRuntimeEnvironment,
  options: DeployCommandOptions = {},
): Promise<DeploymentManifest> {
  const env = options.env ?? process.env
  const log = options.log ?? console.log
  const token = tokenFrom(env)
  const networkConfig = hre.network.config as { url?: string; accounts?: unknown }

  if ('url' in networkConfig && hre.network.name !== 'localhost' && !networkConfig.url) {
    throw new Error(
      `The ${hre.network.name} network has no URL: set SEPOLIA_RPC_URL to your own endpoint. Nothing was sent.`,
    )
  }

  const chainId = BigInt((await hre.network.provider.request({ method: 'eth_chainId' })) as string)
  const target = assertDeployTarget(chainId, options.confirmChainId)
  let manifest: DeploymentManifest

  if (target === 'local') {
    manifest = await deployLocal(hre, { token })
  } else {
    const roles = rolesFromEnv(env)

    if (!Array.isArray(networkConfig.accounts) || networkConfig.accounts.length === 0) {
      throw new Error('DEPLOYER_KEY is not set: the deployer account signs from your environment only. Nothing was sent.')
    }

    const [deployer] = await hre.ethers.getSigners()

    manifest = await deployContracts(hre.artifacts, deployer, {
      network: hre.network.name,
      chainId: Number(chainId),
      token,
      roles,
    })
  }

  log(JSON.stringify(manifest, null, 2))

  if (hre.network.name === 'hardhat') {
    log('\nIn-process chain: nothing was persisted. Use deploy:localhost against `pnpm run node`.')
    return manifest
  }

  const file = manifestPath(hre.network.name)

  writeManifest(file, manifest)
  log(`\nWrote ${file}`)

  if (target === 'local') {
    log('\n# web/api/.env — local Hardhat node only; the key is a public Hardhat test key')
    log(escrowEnvLines(manifest, localAccountKey(hre, manifest.originSigner)).join('\n'))
  } else {
    log(`\n# web/api/.env for ${PUBLIC_TESTNETS[manifest.chainId]}; see web/api/.env.example`)
    log(publicEscrowEnvLines(manifest).join('\n'))
  }

  return manifest
}

/**
 * web/api's lines for a public deployment. No key is among them: off a local
 * chain the origin signer signs through a KMS key the API names, and its key
 * never passes through this script or a terminal.
 */
export function publicEscrowEnvLines(manifest: DeploymentManifest, originTtlSeconds = 86_400): string[] {
  return [
    `APP_ESCROW_CHAIN_ID=${manifest.chainId}`,
    `APP_ESCROW_CONTRACT_ADDRESS=${manifest.escrow.address}`,
    `APP_ESCROW_TOKEN_ADDRESS=${manifest.token.address}`,
    'APP_ESCROW_ORIGIN_SIGNER=kms',
    `APP_ESCROW_ORIGIN_SIGNER_ADDRESS=${manifest.originSigner}`,
    `APP_ESCROW_ORIGIN_SIGNER_KMS_KEY_ID=<id of the KMS key that controls ${manifest.originSigner}>`,
    `APP_ESCROW_ORIGIN_TTL_SECONDS=${originTtlSeconds}`,
    `APP_ESCROW_DEPLOY_BLOCK=${manifest.deployBlock}`,
  ]
}

export type DryRunCommandOptions = {
  forkUrl?: string
  block?: string
  deployer?: string
  env?: NodeJS.ProcessEnv
  log?: (line: string) => void
}

/** Where a rehearsal's manifest goes: beside the real ones, never in their place. */
export function dryRunManifestPath(chainId: number): string {
  const name = PUBLIC_TESTNETS[chainId]?.toLowerCase() ?? `chain-${chainId}`

  return path.join(DEPLOYMENTS_DIR, `${name}.dry-run.json`)
}

/**
 * `deploy:dry-run`: rehearses the public deploy on an in-process fork of
 * `--fork-url` (or DRY_RUN_FORK_URL) and writes the manifest it would have
 * produced. Only the in-process network can hold the fork, so any other
 * `--network` is refused, and with no URL nothing runs at all.
 */
export async function runDryRun(
  hre: HardhatRuntimeEnvironment,
  options: DryRunCommandOptions = {},
): Promise<DeploymentManifest> {
  const env = options.env ?? process.env
  const log = options.log ?? console.log
  const forkUrl = (options.forkUrl ?? env.DRY_RUN_FORK_URL ?? '').trim()

  if (hre.network.name !== 'hardhat') {
    throw new Error(
      `deploy:dry-run forks into the in-process network only, not ${hre.network.name}: drop --network.`,
    )
  }

  if (forkUrl === '') {
    throw new Error(
      'No fork URL: set DRY_RUN_FORK_URL (or pass --fork-url) to the RPC endpoint of the network ' +
        'to rehearse on, e.g. your own Sepolia endpoint. Nothing was run.',
    )
  }

  const block = options.block === undefined ? undefined : Number(options.block)

  if (block !== undefined && (!Number.isSafeInteger(block) || block < 0)) {
    throw new Error(`--block is a block number, not ${options.block}. Nothing was run.`)
  }

  const roles = {
    feeRecipient: (env.FEE_RECIPIENT ?? '').trim() || undefined,
    originSigner: (env.ORIGIN_SIGNER_ADDRESS ?? '').trim() || undefined,
  }
  const manifest = await dryRunDeploy(hre.network.provider, hre.artifacts, {
    forkUrl,
    blockNumber: block,
    deployer: (options.deployer ?? env.DEPLOYER_ADDRESS ?? '').trim() || undefined,
    roles,
    token: tokenFrom(env),
  })
  const file = dryRunManifestPath(manifest.chainId)

  log(JSON.stringify(manifest, null, 2))
  writeManifest(file, manifest)
  log(`\nRehearsed on a fork of chain ${manifest.chainId} at block ${manifest.dryRun?.forkBlock}; nothing was sent to it.`)
  log(`Wrote ${file}`)

  return manifest
}
