import { TypedDataEncoder, ZeroAddress, getAddress, isHexString, verifyTypedData } from 'ethers'

import { OFFICIAL_FORMAT } from './constants'
import { ManifestError } from './manifest'

import type { ManifestDeployment, VerifierManifest } from './manifest'

/**
 * The official deployment allowlist: which escrow and registry addresses are
 * Work Address's own, signed by the key that publishes them.
 *
 * A deployment manifest names addresses; it cannot say who vouches for them.
 * This code is MIT, so a copy of the escrow that its own deployer funds emits
 * a structurally perfect `Released`, and a copy of the registry runs the
 * identical commitment scheme. The only difference between the official
 * deployment and a copy is that someone the reader trusts said which is
 * which. This document is that statement, made once, offline, and checkable
 * by anyone who knows the publisher's address: the site before it asks a
 * wallet to fund an escrow, the marketplace API before it signs terms for
 * one, and the command-line verifier before it reads a receipt from one.
 *
 * The signature is EIP-712 over `OfficialDeployments`, so a hardware wallet
 * shows every field it signs. The domain has no chain: one list names
 * deployments on several chains.
 *
 * Unlike the origin certificate, whose verifier rebuilds the struct from the
 * type the certificate declares (so certificates issued before a field
 * existed still open), this format pins its type and refuses any key it does
 * not know. A field an older verifier ignored could be the one that
 * withdraws a deployment; a trust root has to fail closed on it. A new field
 * is a new `version`, with a new domain version.
 */

export const OFFICIAL_VERSION = 1

export const OFFICIAL_DOMAIN = { name: 'WorkAddressOfficialDeployments', version: '1' } as const

export const OFFICIAL_TYPES = {
  OfficialDeployments: [
    { name: 'issuedAt', type: 'uint64' },
    { name: 'deployments', type: 'OfficialDeployment[]' },
  ],
  OfficialDeployment: [
    { name: 'chainId', type: 'uint256' },
    { name: 'release', type: 'string' },
    { name: 'escrow', type: 'address' },
    { name: 'token', type: 'address' },
    { name: 'tokenDecimals', type: 'uint8' },
    { name: 'identityRegistry', type: 'address' },
    { name: 'originSigner', type: 'address' },
    { name: 'feeRecipient', type: 'address' },
    { name: 'deployBlock', type: 'uint64' },
    { name: 'escrowCodeHash', type: 'bytes32' },
    { name: 'registryCodeHash', type: 'bytes32' },
  ],
} as const

export const OFFICIAL_PRIMARY_TYPE = 'OfficialDeployments'

/** One deployment the publisher vouches for. Addresses are EIP-55; hashes are lowercase hex. */
export type OfficialDeployment = {
  chainId: number
  /** The contracts release it was built from, e.g. `contracts-0.1.0`. */
  release: string
  escrow: string
  token: string
  tokenDecimals: number
  identityRegistry: string
  /** `MarketplaceEscrow.originSigner`: whose terms signatures the escrow accepts. */
  originSigner: string
  feeRecipient: string
  deployBlock: number
  /** The deployment manifest's `runtimeCodeHash` of the escrow and the registry. */
  escrowCodeHash: string
  registryCodeHash: string
}

/** What the publisher signs. */
export type OfficialDeploymentsBody = { issuedAt: number; deployments: OfficialDeployment[] }

/** deployments/official.json, validated by deployments/official.schema.json. */
export type OfficialManifest = OfficialDeploymentsBody & {
  $schema?: string
  format: typeof OFFICIAL_FORMAT
  version: typeof OFFICIAL_VERSION
  /** Who signed it, as the document says. A reader checks against the address it already trusts, never this one. */
  publisher: string
  signature: string
}

export type VerifiedOfficialManifest = {
  publisher: string
  issuedAt: number
  deployments: OfficialDeployment[]
  /** The same deployments in the shape every verifier function takes as `manifest`. */
  manifest: VerifierManifest
}

const DOCUMENT_KEYS = ['$schema', 'format', 'version', 'publisher', 'issuedAt', 'deployments', 'signature']
const DEPLOYMENT_KEYS = OFFICIAL_TYPES.OfficialDeployment.map((field) => field.name as string)
const UINT64_MAX = 2 ** 53 - 1

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parsed(input: unknown): unknown {
  if (typeof input !== 'string') return input

  try {
    return JSON.parse(input)
  } catch {
    throw new ManifestError('The official manifest is not JSON')
  }
}

function onlyKeys(record: Record<string, unknown>, allowed: readonly string[], what: string): void {
  const unknown = Object.keys(record).filter((key) => !allowed.includes(key))

  if (unknown.length > 0) {
    throw new ManifestError(`${what} has fields this verifier does not know, and refuses to ignore: ${unknown.join(', ')}`)
  }
}

function address(value: unknown, what: string): string {
  if (typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value)) {
    try {
      const checked = getAddress(value)

      if (checked !== ZeroAddress) return checked
    } catch {
      // A mixed-case address with a wrong checksum falls through to the refusal.
    }
  }

  throw new ManifestError(`${what} is not a non-zero address: ${JSON.stringify(value)}`)
}

function integer(value: unknown, what: string, max = UINT64_MAX, min = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new ManifestError(`${what} is an integer from ${min} to ${max}, got ${JSON.stringify(value)}`)
  }

  return value
}

function hash(value: unknown, what: string): string {
  if (typeof value !== 'string' || !isHexString(value, 32)) {
    throw new ManifestError(`${what} is a 32-byte hex string, got ${JSON.stringify(value)}`)
  }

  return value.toLowerCase()
}

function deployment(raw: unknown, index: number): OfficialDeployment {
  const what = `deployments[${index}]`

  if (!isRecord(raw)) throw new ManifestError(`${what} is an object`)

  onlyKeys(raw, DEPLOYMENT_KEYS, what)

  if (typeof raw.release !== 'string' || raw.release.length === 0) {
    throw new ManifestError(`${what}.release names the contracts release`)
  }

  return {
    chainId: integer(raw.chainId, `${what}.chainId`, UINT64_MAX, 1),
    release: raw.release,
    escrow: address(raw.escrow, `${what}.escrow`),
    token: address(raw.token, `${what}.token`),
    tokenDecimals: integer(raw.tokenDecimals, `${what}.tokenDecimals`, 36),
    identityRegistry: address(raw.identityRegistry, `${what}.identityRegistry`),
    originSigner: address(raw.originSigner, `${what}.originSigner`),
    feeRecipient: address(raw.feeRecipient, `${what}.feeRecipient`),
    deployBlock: integer(raw.deployBlock, `${what}.deployBlock`),
    escrowCodeHash: hash(raw.escrowCodeHash, `${what}.escrowCodeHash`),
    registryCodeHash: hash(raw.registryCodeHash, `${what}.registryCodeHash`),
  }
}

/** Whether `input` claims to be a signed official manifest, verified or not. */
export function isOfficialManifest(input: unknown): boolean {
  try {
    const value = parsed(input)

    return isRecord(value) && value.format === OFFICIAL_FORMAT
  } catch {
    return false
  }
}

/**
 * Reads the document's shape strictly, without checking the signature: no
 * unknown key, every address non-zero and checksummed where mixed-case, no
 * chain listed twice for the same escrow. Throws `ManifestError`.
 */
export function readOfficialManifest(input: unknown): OfficialManifest {
  const value = parsed(input)

  if (!isRecord(value)) throw new ManifestError('The official manifest is an object')

  onlyKeys(value, DOCUMENT_KEYS, 'The official manifest')

  if (value.format !== OFFICIAL_FORMAT) {
    throw new ManifestError(`Not an official deployment manifest: format is ${JSON.stringify(value.format)}`)
  }
  if (value.version !== OFFICIAL_VERSION) {
    throw new ManifestError(`Official manifest version ${JSON.stringify(value.version)} is not one this verifier reads`)
  }
  if (value.$schema !== undefined && typeof value.$schema !== 'string') {
    throw new ManifestError('The official manifest\'s $schema is a string')
  }
  if (!Array.isArray(value.deployments) || value.deployments.length === 0) {
    throw new ManifestError('The official manifest lists no deployment')
  }
  if (typeof value.signature !== 'string' || !isHexString(value.signature, 65)) {
    throw new ManifestError('The official manifest carries no 65-byte signature')
  }

  const deployments = value.deployments.map(deployment)
  const seen = new Set<string>()

  for (const entry of deployments) {
    const key = `${entry.chainId}:${entry.escrow}`

    if (seen.has(key)) throw new ManifestError(`The official manifest lists escrow ${entry.escrow} on chain ${entry.chainId} twice`)

    seen.add(key)
  }

  return {
    ...(typeof value.$schema === 'string' ? { $schema: value.$schema } : {}),
    format: OFFICIAL_FORMAT,
    version: OFFICIAL_VERSION,
    publisher: address(value.publisher, 'publisher'),
    issuedAt: integer(value.issuedAt, 'issuedAt'),
    deployments,
    signature: value.signature,
  }
}

/** The EIP-712 request a publisher signs, in the shape `eth_signTypedData_v4` takes. */
export function officialTypedData(body: OfficialDeploymentsBody): {
  domain: typeof OFFICIAL_DOMAIN
  types: typeof OFFICIAL_TYPES
  primaryType: typeof OFFICIAL_PRIMARY_TYPE
  message: OfficialDeploymentsBody
} {
  return {
    domain: OFFICIAL_DOMAIN,
    types: OFFICIAL_TYPES,
    primaryType: OFFICIAL_PRIMARY_TYPE,
    message: { issuedAt: body.issuedAt, deployments: body.deployments.map((entry, index) => deployment(entry, index)) },
  }
}

function mutableTypes(): Record<string, { name: string; type: string }[]> {
  return Object.fromEntries(
    Object.entries(OFFICIAL_TYPES).map(([name, fields]) => [name, fields.map((field) => ({ ...field }))]),
  )
}

/** The EIP-712 digest a publisher's signature covers. */
export function officialDigest(body: OfficialDeploymentsBody): string {
  const { message } = officialTypedData(body)

  return TypedDataEncoder.hash(OFFICIAL_DOMAIN, mutableTypes(), message)
}

/**
 * Checks a signed official manifest against the publisher the caller already
 * trusts, and returns what it vouches for. `publisher` comes from the
 * caller's own configuration, never from the document: the document's
 * `publisher` must agree with it, but naming yourself proves nothing. Throws
 * `ManifestError` on any change to the signed fields, a signature by anyone
 * else, or a shape this verifier does not read.
 */
export function verifyOfficialManifest(input: unknown, publisher: string): VerifiedOfficialManifest {
  const document = readOfficialManifest(input)
  let trusted: string

  try {
    trusted = getAddress(publisher)
  } catch {
    throw new ManifestError(`The trusted publisher is not an address: ${JSON.stringify(publisher)}`)
  }

  if (document.publisher !== trusted) {
    throw new ManifestError(`The official manifest names publisher ${document.publisher}, not the trusted ${trusted}`)
  }

  let signer: string

  try {
    signer = verifyTypedData(OFFICIAL_DOMAIN, mutableTypes(), officialTypedData(document).message, document.signature)
  } catch {
    throw new ManifestError('The official manifest signature cannot be read')
  }

  if (signer !== trusted) {
    throw new ManifestError(
      `The official manifest is not signed by ${trusted}: it was changed after signing, or signed by someone else (${signer})`,
    )
  }

  return {
    publisher: trusted,
    issuedAt: document.issuedAt,
    deployments: document.deployments,
    manifest: {
      deployments: document.deployments.map(
        (entry): ManifestDeployment => ({
          chainId: entry.chainId,
          deployBlock: entry.deployBlock,
          identityRegistry: entry.identityRegistry,
          escrow: entry.escrow,
          token: { address: entry.token, decimals: entry.tokenDecimals },
          originSigner: entry.originSigner,
        }),
      ),
    },
  }
}

/** The vouched-for deployment of this escrow on this chain; null when the list does not name it. */
export function officialEscrow(verified: VerifiedOfficialManifest, chainId: number, escrow: string): OfficialDeployment | null {
  let wanted: string

  try {
    wanted = getAddress(escrow)
  } catch {
    return null
  }

  return verified.deployments.find((entry) => entry.chainId === chainId && entry.escrow === wanted) ?? null
}
