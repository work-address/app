import fs from 'fs'
import path from 'path'
import { HDNodeWallet, Mnemonic, Wallet, getAddress } from 'ethers'

import type { HardhatRuntimeEnvironment } from 'hardhat/types'

import { LOCAL_CHAIN_ID, TEST_TOKENS, deployContracts } from './deployment'

import type { DeploymentManifest, TestToken } from './deployment'

/**
 * The one chain these scripts may touch: Hardhat's own, in process or as a
 * `hardhat node`. Nothing here is reviewed for real funds (SPEC §14), the
 * test tokens have an open mint, and the time helpers only exist on Hardhat.
 */
export { LOCAL_CHAIN_ID }

export const DEFAULT_LOCAL_RPC_URL = 'http://127.0.0.1:8545'

/**
 * Where `--network localhost` looks for the node. LOCAL_RPC_URL moves it, so a
 * second node — a journey run's own chain, say — can stand beside the one a
 * developer already has on 8545 (`hardhat node --port`) without either taking
 * the other's. The chain id is pinned either way, so a URL that answers as
 * another chain is still refused.
 */
export function localRpcUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.LOCAL_RPC_URL ?? '').trim() || DEFAULT_LOCAL_RPC_URL
}

export const LOCAL_RPC_URL = localRpcUrl()

export const DEPLOYMENTS_DIR = path.resolve(__dirname, '..', 'deployments')

export const LOCAL_TOKENS = TEST_TOKENS

export type LocalToken = TestToken

/** What `deploy:localhost` wrote, validated by deployments/manifest.schema.json. */
export type LocalDeployment = DeploymentManifest

/**
 * Throws unless the chain is the local Hardhat chain. Mainnet gets its own
 * message, because it is the one mistake that would cost real money.
 */
export function assertLocalChain(chainId: bigint | number): void {
  const id = BigInt(chainId)

  if (id === BigInt(1)) {
    throw new Error(
      'Refusing chainId 1 (Ethereum mainnet): these scripts deploy unaudited ' +
        'contracts, mint test tokens and move chain time, and only ever target ' +
        `the local Hardhat chain (${LOCAL_CHAIN_ID}).`,
    )
  }

  if (id !== BigInt(LOCAL_CHAIN_ID)) {
    throw new Error(
      `Refusing chainId ${id}: only the local Hardhat chain (${LOCAL_CHAIN_ID}) may be targeted.`,
    )
  }
}

/** Asks the connected node for its chain id, uncached, and refuses anything but 31337. */
export async function requireLocalChain(
  hre: Pick<HardhatRuntimeEnvironment, 'network'>,
): Promise<number> {
  const chainId = BigInt(
    (await hre.network.provider.request({ method: 'eth_chainId' })) as string,
  )

  assertLocalChain(chainId)

  return Number(chainId)
}

export function manifestPath(networkName: string): string {
  return path.join(DEPLOYMENTS_DIR, `${networkName}.json`)
}

/**
 * Deploys the local test USDT (TetherLikeUSDT unless told otherwise, so the
 * mainnet approve-reset rule is exercised), the escrow and the identity
 * registry, in that order, from the node's account #0, with #1 as the fee
 * recipient and #2 as the origin signer. On a fresh node the deployer's
 * nonces 0, 1 and 2 make the addresses the ones web/api/.env.example
 * documents.
 */
export async function deployLocal(
  hre: HardhatRuntimeEnvironment,
  options: { token?: LocalToken } = {},
): Promise<LocalDeployment> {
  const chainId = await requireLocalChain(hre)
  const token = options.token ?? 'TetherLikeUSDT'

  if (!LOCAL_TOKENS.includes(token)) {
    throw new Error(`Unknown local token ${token}: use ${LOCAL_TOKENS.join(' or ')}`)
  }

  const [deployer, feeRecipient, originSigner] = await hre.ethers.getSigners()

  return deployContracts(hre.artifacts, deployer, {
    network: hre.network.name,
    chainId,
    token,
    roles: { feeRecipient: feeRecipient.address, originSigner: originSigner.address },
  })
}

export function writeManifest(file: string, manifest: LocalDeployment): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`)
}

/**
 * Reads a manifest and checks it describes the chain the caller is connected
 * to, so a stale file from another chain is never used to mint or sign.
 */
export async function readManifest(
  hre: HardhatRuntimeEnvironment,
  file: string,
): Promise<LocalDeployment> {
  const chainId = await requireLocalChain(hre)

  if (!fs.existsSync(file)) {
    throw new Error(`No deployment manifest at ${file}: run \`npm run deploy:localhost\` first.`)
  }

  const manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as LocalDeployment

  assertLocalChain(manifest.chainId)

  if (manifest.chainId !== chainId) {
    throw new Error(`${file} is for chain ${manifest.chainId}, connected to ${chainId}`)
  }

  // A restarted node forgets every contract; the manifest outlives it.
  if ((await hre.ethers.provider.getCode(manifest.token.address)) === '0x') {
    throw new Error(
      `No contract at ${manifest.token.address}: the node was restarted since ` +
        'the deploy. Run `npm run deploy:localhost` again.',
    )
  }

  return manifest
}

/**
 * The private key of one of the local node's own accounts, when `address` is
 * one. These are Hardhat's public test accounts — `hardhat node` prints every
 * key on start — so the result is never a secret and never usable elsewhere.
 */
export function localAccountKey(
  hre: Pick<HardhatRuntimeEnvironment, 'config'>,
  address: string,
): string | null {
  const accounts = hre.config.networks.hardhat.accounts
  const wanted = getAddress(address)

  if (Array.isArray(accounts)) {
    const match = accounts.find(
      (account) => new Wallet(account.privateKey).address === wanted,
    )

    return match ? match.privateKey : null
  }

  const seed = Mnemonic.fromPhrase(accounts.mnemonic, accounts.passphrase).computeSeed()
  const root = HDNodeWallet.fromSeed(seed)

  for (let i = 0; i < accounts.count; i++) {
    const wallet = root.derivePath(`${accounts.path}/${accounts.initialIndex + i}`)

    if (wallet.address === wanted) {
      return wallet.privateKey
    }
  }

  return null
}

/**
 * The lines web/api reads (api/src/app/app-config.ts) to enable escrow
 * against this deployment. Without a known key for the origin signer the key
 * line is left for the operator to fill in.
 */
export function escrowEnvLines(
  manifest: LocalDeployment,
  originSignerKey: string | null,
  originTtlSeconds = 86_400,
): string[] {
  return [
    `APP_ESCROW_CHAIN_ID=${manifest.chainId}`,
    `APP_ESCROW_CONTRACT_ADDRESS=${manifest.escrow.address}`,
    `APP_ESCROW_TOKEN_ADDRESS=${manifest.token.address}`,
    `APP_ESCROW_ORIGIN_SIGNER_KEY=${originSignerKey ?? `<private key of ${manifest.originSigner}>`}`,
    `APP_ESCROW_ORIGIN_TTL_SECONDS=${originTtlSeconds}`,
  ]
}

/**
 * Makes a `hardhat node` mine a block every `intervalMs` even when idle, so
 * the latest block's timestamp — which the escrow panel treats as "now" —
 * keeps pace with the clock instead of freezing at the last transaction.
 */
export async function enableIntervalMining(
  provider: HardhatRuntimeEnvironment['network']['provider'],
  intervalMs = 5_000,
): Promise<void> {
  await provider.request({ method: 'evm_setIntervalMining', params: [intervalMs] })
}
