import fs from 'fs'
import path from 'path'
import { HDNodeWallet, Mnemonic, Wallet, getAddress } from 'ethers'

import type { HardhatRuntimeEnvironment } from 'hardhat/types'

/**
 * The one chain these scripts may touch: Hardhat's own, in process or as a
 * `hardhat node`. Nothing here is reviewed for real funds (SPEC §14), the
 * test tokens have an open mint, and the time helpers only exist on Hardhat.
 */
export const LOCAL_CHAIN_ID = 31337

export const LOCAL_RPC_URL = 'http://127.0.0.1:8545'

export const DEPLOYMENTS_DIR = path.resolve(__dirname, '..', 'deployments')

export const LOCAL_TOKENS = ['TetherLikeUSDT', 'MockUSDT'] as const

export type LocalToken = (typeof LOCAL_TOKENS)[number]

/** What `deploy:localhost` wrote, validated by deployments/manifest.schema.json. */
export type LocalDeployment = {
  $schema: string
  network: string
  chainId: number
  /** First block holding any of these contracts: where an indexer starts. */
  deployBlock: number
  deployer: string
  feeRecipient: string
  originSigner: string
  token: { contract: LocalToken; address: string; decimals: number }
  escrow: { contract: 'MarketplaceEscrow'; address: string }
  identityRegistry: { contract: 'IdentityRegistry'; address: string }
}

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
 * registry, in that order. On a fresh node the deployer's nonces 0, 1 and 2
 * make the addresses the ones web/api/.env.example documents.
 */
export async function deployLocal(
  hre: HardhatRuntimeEnvironment,
  options: { token?: LocalToken } = {},
): Promise<LocalDeployment> {
  const chainId = await requireLocalChain(hre)
  const tokenContract = options.token ?? 'TetherLikeUSDT'

  if (!LOCAL_TOKENS.includes(tokenContract)) {
    throw new Error(`Unknown local token ${tokenContract}: use ${LOCAL_TOKENS.join(' or ')}`)
  }

  const { ethers } = hre
  const [deployer, feeRecipient, originSigner] = await ethers.getSigners()

  const token = await (await ethers.getContractFactory(tokenContract)).deploy()
  const tokenReceipt = await token.deploymentTransaction()?.wait()
  const tokenAddress = await token.getAddress()

  const escrow = await (
    await ethers.getContractFactory('MarketplaceEscrow')
  ).deploy(tokenAddress, feeRecipient.address, originSigner.address)
  await escrow.deploymentTransaction()?.wait()

  const registry = await (await ethers.getContractFactory('IdentityRegistry')).deploy()
  await registry.deploymentTransaction()?.wait()

  if (!tokenReceipt) {
    throw new Error('The token deployment has no receipt')
  }

  return {
    $schema: './manifest.schema.json',
    network: hre.network.name,
    chainId,
    deployBlock: tokenReceipt.blockNumber,
    deployer: deployer.address,
    feeRecipient: feeRecipient.address,
    originSigner: originSigner.address,
    token: { contract: tokenContract, address: tokenAddress, decimals: 6 },
    escrow: { contract: 'MarketplaceEscrow', address: await escrow.getAddress() },
    identityRegistry: {
      contract: 'IdentityRegistry',
      address: await registry.getAddress(),
    },
  }
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
