import { dataSlice, decodeBase58, encodeBase58, getAddress, keccak256, toBeArray, toUtf8Bytes } from 'ethers'

import { SOLANA_MAINNET } from './constants'
import { ProfileError } from './errors'

/**
 * Subjects are named with `did:pkh` (CAIP-10 accounts). That is a naming
 * convention only: no DID method, resolver or DID Core conformance is claimed.
 */

/** An EVM account. It can anchor to `IdentityRegistry` on `chainId`, and signs self-signed mode with EIP-191. */
export type EvmSubject = {
  scheme: 'eip155'
  did: string
  chainId: number
  /** EIP-55. */
  address: string
  /** The `address subject` every leaf binds: the account itself. */
  leafSubject: string
}

/**
 * A Solana account. The registry keys records by a 20-byte EVM address, so a
 * Solana key cannot anchor there (IdentityRegistry.sol, "Subject scheme").
 * It gets self-signed mode with Ed25519.
 */
export type SolanaSubject = {
  scheme: 'solana'
  did: string
  /** CAIP-2 reference: the first 32 characters of the cluster's genesis hash. */
  reference: string
  /** Base58 public key. */
  address: string
  publicKey: Uint8Array
  /** The low 20 bytes of keccak256(UTF-8 did), so leaves stay bound to this subject. */
  leafSubject: string
}

export type Subject = EvmSubject | SolanaSubject

const EVM_DID = /^did:pkh:eip155:([1-9][0-9]*):(0x[0-9a-fA-F]{40})$/
const SOLANA_DID = /^did:pkh:solana:([1-9A-HJ-NP-Za-km-z]{32}):([1-9A-HJ-NP-Za-km-z]{32,44})$/
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/

function positiveChainId(chainId: number | bigint): number {
  const value = Number(chainId)

  if (!Number.isSafeInteger(value) || value <= 0 || BigInt(value) !== BigInt(chainId)) {
    throw new ProfileError('InvalidSubject', `A chain id is a positive safe integer, got ${chainId}`)
  }

  return value
}

export function evmSubject(address: string, chainId: number | bigint): EvmSubject {
  let checksummed: string

  try {
    checksummed = getAddress(address)
  } catch {
    throw new ProfileError('InvalidSubject', `Not an EVM address: ${address}`)
  }

  const chain = positiveChainId(chainId)

  return {
    scheme: 'eip155',
    did: `did:pkh:eip155:${chain}:${checksummed}`,
    chainId: chain,
    address: checksummed,
    leafSubject: checksummed,
  }
}

/** The 32-byte key a canonical base58 Solana address encodes. */
function solanaPublicKey(address: string): Uint8Array {
  if (!BASE58.test(address)) {
    throw new ProfileError('InvalidSubject', `Not a base58 Solana address: ${address}`)
  }

  const leadingZeros = address.length - address.replace(/^1+/, '').length
  const body = toBeArray(decodeBase58(address))
  const key = new Uint8Array(leadingZeros + body.length)

  key.set(body, leadingZeros)

  if (key.length !== 32 || encodeBase58(key) !== address) {
    throw new ProfileError('InvalidSubject', `A Solana address is a canonical base58 32-byte key: ${address}`)
  }

  return key
}

export function solanaSubject(address: string, reference: string = SOLANA_MAINNET): SolanaSubject {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32}$/.test(reference)) {
    throw new ProfileError('InvalidSubject', `A Solana CAIP-2 reference is 32 base58 characters: ${reference}`)
  }

  const publicKey = solanaPublicKey(address)
  const did = `did:pkh:solana:${reference}:${address}`

  return {
    scheme: 'solana',
    did,
    reference,
    address,
    publicKey,
    leafSubject: getAddress(dataSlice(keccak256(toUtf8Bytes(did)), 12)),
  }
}

/**
 * Parses a subject DID, accepting only its canonical spelling: an EIP-55
 * address and a decimal chain id without leading zeros, or a canonical
 * base58 Solana key. Any other `did:` is `UnsupportedSubjectScheme`; TON's
 * signData variant can be added later.
 */
export function parseSubject(did: string): Subject {
  if (typeof did !== 'string') {
    throw new ProfileError('InvalidSubject', 'A subject is a did:pkh string')
  }

  if (did.startsWith('did:pkh:eip155:')) {
    const match = EVM_DID.exec(did)

    if (!match) throw new ProfileError('InvalidSubject', `Malformed did:pkh:eip155 subject: ${did}`)

    const subject = evmSubject(match[2], Number(match[1]))

    if (subject.did !== did) {
      throw new ProfileError('InvalidSubject', `The subject's address must be EIP-55 checksummed: ${did}`)
    }

    return subject
  }

  if (did.startsWith('did:pkh:solana:')) {
    const match = SOLANA_DID.exec(did)

    if (!match) throw new ProfileError('InvalidSubject', `Malformed did:pkh:solana subject: ${did}`)

    return solanaSubject(match[2], match[1])
  }

  if (/^did:[a-z0-9]+:/.test(did)) {
    throw new ProfileError('UnsupportedSubjectScheme', `Only did:pkh:eip155 and did:pkh:solana subjects are supported: ${did}`)
  }

  throw new ProfileError('InvalidSubject', `Not a DID: ${did}`)
}

export function toSubject(subject: Subject | string): Subject {
  return typeof subject === 'string' ? parseSubject(subject) : parseSubject(subject.did)
}
