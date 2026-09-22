import { BrowserProvider, ContractFactory, JsonRpcSigner, getAddress, getBytes, isAddress, keccak256, parseEther, toQuantity, ZeroAddress } from 'ethers'

import type { Signer } from 'ethers'
import type { Artifacts, EIP1193Provider } from 'hardhat/types'

/**
 * What every deploy shares — local, rehearsed on a fork, or to a public
 * testnet: which chains may be targeted at all, the contracts deployed and
 * in what order, and the manifest that records them with enough to rebuild
 * and re-check the bytecode (SPEC §14: "a reproducible, verified
 * deployment").
 *
 * The only chain these scripts reach without being told to is Hardhat's own
 * (31337). A public testnet takes an explicit `--confirm-chain-id` naming the
 * chain the endpoint answers as; Ethereum mainnet is refused whatever is
 * passed, because nothing here has had the security review SPEC §14 asks
 * for, and the flag is not a review.
 */

export const LOCAL_CHAIN_ID = 31337

export const MAINNET_CHAIN_ID = 1

/** Public chains a deploy may target once confirmed. Sepolia has no official Tether, so its token is the mock. */
export const PUBLIC_TESTNETS: Readonly<Record<number, string>> = { 11155111: 'Sepolia' }

export const SEPOLIA_CHAIN_ID = 11155111

export const TEST_TOKENS = ['TetherLikeUSDT', 'MockUSDT'] as const

export type TestToken = (typeof TEST_TOKENS)[number]

export type DeployTarget = 'local' | 'public'

/** One deployed contract, with the hashes that let anyone hold it to the compiler's output. */
export type DeployedContract<Name extends string> = {
  contract: Name
  address: string
  /** keccak256 of the compiler's creation bytecode, before constructor arguments. */
  creationCodeHash: string
  /**
   * keccak256 of the code on chain with every immutable zeroed, which is the
   * compiler's runtime bytecode: the deploy refuses to write a manifest when
   * the two differ, and a verifier recomputes it from `eth_getCode` alone.
   */
  runtimeCodeHash: string
}

export type CompilerRecord = {
  /** solc's long version, commit included. */
  solc: string
  optimizer: { enabled: boolean; runs: number }
  evmVersion: string
}

/** A deploy rehearsed on an in-process fork: nothing it describes exists on the forked chain. */
export type DryRunRecord = {
  /** The block of the forked chain the rehearsal started from. */
  forkBlock: number
  /** The chain id the in-process fork itself answered as. */
  simulatedChainId: number
  /** The deployer had too little ETH on the forked chain, so the fork gave it some. */
  gasSimulated: boolean
}

/** What a deploy writes to deployments/<network>.json, validated by deployments/manifest.schema.json. */
export type DeploymentManifest = {
  $schema: string
  network: string
  chainId: number
  /** First block holding any of these contracts: where an indexer starts. */
  deployBlock: number
  deployer: string
  feeRecipient: string
  originSigner: string
  compiler: CompilerRecord
  token: DeployedContract<TestToken> & { decimals: number; mock: true }
  escrow: DeployedContract<'MarketplaceEscrow'>
  identityRegistry: DeployedContract<'IdentityRegistry'>
  dryRun?: DryRunRecord
}

export type DeployRoles = { feeRecipient: string; originSigner: string }

/**
 * Throws unless a deploy may target `chainId`. The local Hardhat chain needs
 * nothing; a public testnet needs `confirmChainId` equal to the chain the
 * endpoint answers as, so a mistyped URL cannot land a deploy elsewhere;
 * mainnet and every unlisted chain are refused whatever is passed.
 */
export function assertDeployTarget(
  chainId: bigint | number,
  confirmChainId?: bigint | number | string | null,
): DeployTarget {
  const id = BigInt(chainId)

  if (id === BigInt(MAINNET_CHAIN_ID)) {
    throw new Error(
      'Refusing chainId 1 (Ethereum mainnet): the contracts have not had the ' +
        'independent review SPEC §14 requires before real funds, and no flag lifts that.',
    )
  }

  if (id === BigInt(LOCAL_CHAIN_ID)) {
    return 'local'
  }

  const name = PUBLIC_TESTNETS[Number(id)]

  if (name === undefined) {
    throw new Error(
      `Refusing chainId ${id}: deploys target the local Hardhat chain (${LOCAL_CHAIN_ID}) ` +
        `or, confirmed, ${Object.entries(PUBLIC_TESTNETS)
          .map(([testnet, label]) => `${label} (${testnet})`)
          .join(', ')}.`,
    )
  }

  if (confirmChainId === undefined || confirmChainId === null || String(confirmChainId).trim() === '') {
    throw new Error(
      `Refusing chainId ${id} (${name}) without confirmation: only the local Hardhat chain ` +
        `(${LOCAL_CHAIN_ID}) is deployed to unasked. To deploy to ${name} on purpose, pass ` +
        `--confirm-chain-id ${id}.`,
    )
  }

  if (String(confirmChainId).trim() !== String(id)) {
    throw new Error(
      `Refusing chainId ${id} (${name}): the confirmation names chain ${String(confirmChainId).trim()}, ` +
        'but the endpoint answers as another. Check the RPC URL.',
    )
  }

  return 'public'
}

/** Reads the fee recipient and origin signer a public deploy fixes for good. Never a key. */
export function rolesFromEnv(env: NodeJS.ProcessEnv): DeployRoles {
  const read = (name: string, what: string): string => {
    const value = (env[name] ?? '').trim()

    if (value === '') {
      throw new Error(`${name} is not set: it names ${what}, fixed in the escrow for good.`)
    }
    if (!isAddress(value) || getAddress(value) === ZeroAddress) {
      throw new Error(`${name} is not an address: ${value}`)
    }

    return getAddress(value)
  }

  return {
    feeRecipient: read('FEE_RECIPIENT', 'the account that receives the 5% fee (a multisig)'),
    originSigner: read('ORIGIN_SIGNER_ADDRESS', "the address whose EIP-712 signature the escrow accepts as the marketplace's origin proof"),
  }
}

/** The compiler and settings the escrow was built with, from its build info. */
export async function compilerRecord(artifacts: Artifacts): Promise<CompilerRecord> {
  const buildInfo = await artifacts.getBuildInfo('contracts/MarketplaceEscrow.sol:MarketplaceEscrow')

  if (!buildInfo) {
    throw new Error('No build info for MarketplaceEscrow: run `pnpm run build` first.')
  }

  const { optimizer, evmVersion } = buildInfo.input.settings

  return {
    solc: buildInfo.solcLongVersion,
    optimizer: { enabled: Boolean(optimizer.enabled), runs: Number(optimizer.runs) },
    evmVersion: String(evmVersion),
  }
}

type ImmutableReferences = Record<string, { start: number; length: number }[]>

/**
 * The hashes of `name` as compiled, and of the code at `address` with its
 * immutables zeroed. Throws when the two runtime codes differ: whatever is
 * at that address is not this contract as this compiler built it.
 */
export async function codeHashes(
  artifacts: Artifacts,
  name: string,
  onChainCode: string,
): Promise<{ creationCodeHash: string; runtimeCodeHash: string }> {
  const artifact = await artifacts.readArtifact(name)
  const qualified = `${artifact.sourceName}:${artifact.contractName}`
  const buildInfo = await artifacts.getBuildInfo(qualified)

  if (!buildInfo) {
    throw new Error(`No build info for ${qualified}: run \`pnpm run build\` first.`)
  }

  const output = buildInfo.output.contracts[artifact.sourceName][artifact.contractName] as unknown as {
    evm: { deployedBytecode: { immutableReferences?: ImmutableReferences } }
  }
  const code = getBytes(onChainCode)

  for (const ranges of Object.values(output.evm.deployedBytecode.immutableReferences ?? {})) {
    for (const { start, length } of ranges) {
      code.fill(0, start, start + length)
    }
  }

  const runtimeCodeHash = keccak256(code)
  const compiledRuntimeHash = keccak256(artifact.deployedBytecode)

  if (runtimeCodeHash !== compiledRuntimeHash) {
    throw new Error(
      `The code deployed as ${artifact.contractName} is not the compiled ${qualified}: ` +
        `${runtimeCodeHash} on chain, ${compiledRuntimeHash} compiled.`,
    )
  }

  return { creationCodeHash: keccak256(artifact.bytecode), runtimeCodeHash }
}

type Deployed = { address: string; blockNumber: number }

/** Deploys one artifact from `deployer` and waits for it to be mined. */
async function deployOne(artifacts: Artifacts, deployer: Signer, name: string, args: unknown[]): Promise<Deployed> {
  const artifact = await artifacts.readArtifact(name)
  const contract = await new ContractFactory(artifact.abi, artifact.bytecode, deployer).deploy(...args)
  const receipt = await contract.deploymentTransaction()?.wait()

  if (!receipt) {
    throw new Error(`The ${name} deployment has no receipt`)
  }

  return { address: await contract.getAddress(), blockNumber: receipt.blockNumber }
}

/**
 * Deploys the test USDT, the escrow and the identity registry from
 * `deployer`, in that order, and returns the manifest describing them. On a
 * fresh local node the deployer's nonces 0, 1 and 2 make the addresses the
 * ones web/api/.env.example documents.
 */
export async function deployContracts(
  artifacts: Artifacts,
  deployer: Signer,
  options: { network: string; chainId: number; token: TestToken; roles: DeployRoles },
): Promise<DeploymentManifest> {
  if (!TEST_TOKENS.includes(options.token)) {
    throw new Error(`Unknown test token ${options.token}: use ${TEST_TOKENS.join(' or ')}`)
  }

  const provider = deployer.provider

  if (!provider) {
    throw new Error('The deployer has no provider')
  }

  const { feeRecipient, originSigner } = options.roles
  const token = await deployOne(artifacts, deployer, options.token, [])
  const escrow = await deployOne(artifacts, deployer, 'MarketplaceEscrow', [token.address, feeRecipient, originSigner])
  const registry = await deployOne(artifacts, deployer, 'IdentityRegistry', [])
  const hashes = async (name: string, address: string) => codeHashes(artifacts, name, await provider.getCode(address))

  return {
    $schema: './manifest.schema.json',
    network: options.network,
    chainId: options.chainId,
    deployBlock: token.blockNumber,
    deployer: getAddress(await deployer.getAddress()),
    feeRecipient: getAddress(feeRecipient),
    originSigner: getAddress(originSigner),
    compiler: await compilerRecord(artifacts),
    token: {
      contract: options.token,
      address: token.address,
      decimals: 6,
      mock: true,
      ...(await hashes(options.token, token.address)),
    },
    escrow: { contract: 'MarketplaceEscrow', address: escrow.address, ...(await hashes('MarketplaceEscrow', escrow.address)) },
    identityRegistry: {
      contract: 'IdentityRegistry',
      address: registry.address,
      ...(await hashes('IdentityRegistry', registry.address)),
    },
  }
}

/** One JSON-RPC call over HTTP: how the dry run reads the chain it forks, and all it ever asks it. */
async function rpcCall(url: string, method: string, params: unknown[] = []): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const body = (await response.json()) as { result?: unknown; error?: { message: string } }

  if (body.error) {
    throw new Error(`${method} at the fork URL failed: ${body.error.message}`)
  }

  return body.result
}

/** Below this the deployer cannot pay for three deployments on the fork, and is given GAS_TOP_UP there. */
const GAS_FLOOR = parseEther('1')
const GAS_TOP_UP = parseEther('100')

export type DryRunOptions = {
  /** JSON-RPC endpoint of the chain to rehearse on. Only ever read, through the fork. */
  forkUrl: string
  /** The block to fork at; the forked chain's latest when absent, recorded either way. */
  blockNumber?: number
  /** The account the real deploy would send from: its nonce there predicts the addresses. Never a key. */
  deployer?: string
  roles?: Partial<DeployRoles>
  token?: TestToken
}

/**
 * Rehearses a deploy on an in-process fork of `forkUrl`, without a key and
 * without sending the forked chain anything but reads.
 *
 * `provider` must be an in-process Hardhat network: it is reset onto a fork
 * of the chain at `forkUrl`, pinned to one block, and every transaction goes
 * to it alone. With `deployer` set, that account is impersonated on the
 * fork, so the addresses in the manifest are the ones a real deploy from it,
 * at its nonce at that block, would get. The fork answers as chain 31337, so
 * the chain guard holds too: nothing here can be confirmed onto a public
 * chain.
 */
export async function dryRunDeploy(
  provider: EIP1193Provider,
  artifacts: Artifacts,
  options: DryRunOptions,
): Promise<DeploymentManifest> {
  const forkedChainId = Number(BigInt((await rpcCall(options.forkUrl, 'eth_chainId')) as string))

  if (forkedChainId === MAINNET_CHAIN_ID) {
    throw new Error(
      'Refusing to rehearse on Ethereum mainnet (chainId 1): a manifest for it has no ' +
        'form until the SPEC §14 review is met.',
    )
  }

  const forkBlock =
    options.blockNumber ?? Number(BigInt((await rpcCall(options.forkUrl, 'eth_blockNumber')) as string))

  await provider.request({
    method: 'hardhat_reset',
    params: [{ forking: { jsonRpcUrl: options.forkUrl, blockNumber: forkBlock } }],
  })

  const simulatedChainId = Number(BigInt((await provider.request({ method: 'eth_chainId' })) as string))

  if (assertDeployTarget(simulatedChainId) !== 'local') {
    throw new Error(`The dry run's own chain answers as ${simulatedChainId}, not the in-process ${LOCAL_CHAIN_ID}`)
  }

  const accounts = ((await provider.request({ method: 'eth_accounts' })) as string[]).map((account) => getAddress(account))
  const deployer = getAddress(options.deployer ?? accounts[0])
  let gasSimulated = false

  if (!accounts.includes(deployer)) {
    await provider.request({ method: 'hardhat_impersonateAccount', params: [deployer] })
  }

  if (BigInt((await provider.request({ method: 'eth_getBalance', params: [deployer, 'latest'] })) as string) < GAS_FLOOR) {
    await provider.request({ method: 'hardhat_setBalance', params: [deployer, toQuantity(GAS_TOP_UP)] })
    gasSimulated = true
  }

  // Built directly: an impersonated account is not among eth_accounts, which getSigner() insists on.
  const signer = new JsonRpcSigner(new BrowserProvider(provider), deployer)
  const manifest = await deployContracts(artifacts, signer, {
    network: PUBLIC_TESTNETS[forkedChainId]?.toLowerCase() ?? `chain-${forkedChainId}`,
    chainId: forkedChainId,
    token: options.token ?? 'TetherLikeUSDT',
    roles: {
      feeRecipient: getAddress(options.roles?.feeRecipient ?? accounts[1]),
      originSigner: getAddress(options.roles?.originSigner ?? accounts[2]),
    },
  })

  return { ...manifest, dryRun: { forkBlock, simulatedChainId, gasSimulated } }
}

