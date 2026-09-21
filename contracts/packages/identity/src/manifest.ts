import { getAddress } from 'ethers'

/**
 * Which deployments a verifier accepts. It is the trust root of every check
 * that touches a chain: a copy of `IdentityRegistry` anyone deployed runs the
 * same commitment scheme, and a copy of the escrow funded by its own deployer
 * emits a structurally perfect `Released`. Neither means anything unless the
 * verifier was told, by someone it trusts, that this address is the one.
 *
 * The shape is the deployment manifest `scripts/deploy.ts` writes
 * (`deployments/manifest.schema.json`); keys a verifier has no use for are
 * ignored. Pass one deployment or a list of them.
 */
export type ManifestDeployment = {
  chainId: number
  /** First block holding these contracts: where a log scan starts. */
  deployBlock: number
  /** EIP-55, or null where the manifest lists none. */
  identityRegistry: string | null
  escrow: string | null
  token: { address: string; decimals: number } | null
  /** `MarketplaceEscrow.originSigner`, as the manifest publishes it. */
  originSigner: string | null
}

export type VerifierManifest = { deployments: ManifestDeployment[] }

export class ManifestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ManifestError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function address(value: unknown, what: string): string {
  try {
    if (typeof value === 'string') return getAddress(value)
  } catch {
    // Falls through to the refusal below.
  }

  throw new ManifestError(`The manifest's ${what} is not an address: ${JSON.stringify(value)}`)
}

function addressOf(entry: unknown, what: string): string | null {
  if (entry === undefined || entry === null) return null

  return address(isRecord(entry) ? entry.address : entry, what)
}

function deployment(raw: unknown): ManifestDeployment {
  if (!isRecord(raw)) throw new ManifestError('A manifest deployment is an object')

  const { chainId, deployBlock } = raw

  if (typeof chainId !== 'number' || !Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new ManifestError(`The manifest's chainId is a positive integer, got ${JSON.stringify(chainId)}`)
  }
  if (deployBlock !== undefined && (typeof deployBlock !== 'number' || !Number.isSafeInteger(deployBlock) || deployBlock < 0)) {
    throw new ManifestError(`The manifest's deployBlock is a block number, got ${JSON.stringify(deployBlock)}`)
  }

  let token: ManifestDeployment['token'] = null

  if (isRecord(raw.token)) {
    const decimals = raw.token.decimals

    if (typeof decimals !== 'number' || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
      throw new ManifestError(`The manifest's token.decimals is a small integer, got ${JSON.stringify(decimals)}`)
    }

    token = { address: address(raw.token.address, 'token.address'), decimals }
  }

  return {
    chainId,
    deployBlock: deployBlock ?? 0,
    identityRegistry: addressOf(raw.identityRegistry, 'identityRegistry'),
    escrow: addressOf(raw.escrow, 'escrow'),
    token,
    originSigner: addressOf(raw.originSigner, 'originSigner'),
  }
}

/** Reads a deployment manifest, a list of them, or an already-read manifest. Throws `ManifestError`. */
export function readManifest(input: unknown): VerifierManifest {
  let parsed: unknown = input

  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input)
    } catch {
      throw new ManifestError('The manifest is not JSON')
    }
  }

  if (isRecord(parsed) && Array.isArray(parsed.deployments)) parsed = parsed.deployments

  const list = Array.isArray(parsed) ? parsed : [parsed]

  if (list.length === 0) throw new ManifestError('The manifest lists no deployment')

  return { deployments: list.map(deployment) }
}

/** The deployment whose registry this is, on this chain; null when the manifest does not list it. */
export function registryDeployment(manifest: VerifierManifest, chainId: number, registry: string): ManifestDeployment | null {
  return (
    manifest.deployments.find(
      (entry) => entry.chainId === chainId && entry.identityRegistry !== null && entry.identityRegistry === getAddress(registry),
    ) ?? null
  )
}

/** The deployment whose escrow this is, on this chain; null when the manifest does not list it. */
export function escrowDeployment(manifest: VerifierManifest, chainId: number, escrow: string): ManifestDeployment | null {
  return (
    manifest.deployments.find((entry) => entry.chainId === chainId && entry.escrow !== null && entry.escrow === getAddress(escrow)) ??
    null
  )
}
