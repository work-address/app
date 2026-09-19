import { getAddress } from 'ethers'

import { FORMAT_VERSION, PRESENTATION_FORMAT, PROOF_LENGTH, SCHEMA_ID_V1 } from './constants'
import { isTimestamp } from './documents'
import { ProfileError } from './errors'
import { canonicalJson } from './jcs'
import { FIRST_RESERVED_SLOT, isCanonicalFieldValue, slotDefinition } from './schema'
import { selfSignedMessage, signatureSchemeFor, verifySelfSignature } from './self-signed'
import { parseSubject } from './subject'
import { isBytes32, processProof, profileCommitment, profileLeaf } from './tree'

import type { FieldKey, FieldValue } from './schema'
import type { SelfSignature } from './self-signed'
import type { EvmSubject, Subject } from './subject'

/**
 * Everything a verifier can check about a presentation without a network:
 * shape, schema, subject, every disclosure's proof against the root, and
 * either the commitment (anchored) or the subject's signature (self-signed).
 *
 * For an anchored presentation this is half the answer. `registryCheck` holds
 * the exact arguments for `IdentityRegistry.checkPresentation`, which says
 * whether that commitment is the subject's current, superseded or withdrawn
 * version. That call needs an RPC endpoint and is deliberately not made here.
 */
export type PresentationFailure =
  | 'MalformedPresentation'
  | 'UnsupportedFormat'
  | 'UnsupportedSchema'
  | 'UnsupportedSubjectScheme'
  | 'InvalidProof'
  | 'CommitmentMismatch'
  | 'SignatureInvalid'

export type DisclosedField = { slot: number; key: FieldKey; pointer: string; value: FieldValue }

export type RegistryCheck = {
  chainId: number
  registry: string
  subject: string
  version: number
  commitment: string
  schemaId: number
}

export type PresentationCheck =
  | {
      ok: true
      mode: 'anchored'
      subject: EvmSubject
      root: string
      commitment: string
      disclosed: DisclosedField[]
      registryCheck: RegistryCheck
    }
  | {
      ok: true
      mode: 'self-signed'
      subject: Subject
      root: string
      disclosed: DisclosedField[]
      /** The EVM address or Solana public key that signed. It says who wrote this, not that anyone checked it. */
      signer: string
    }
  | { ok: false; reason: PresentationFailure; detail: string }

const PRESENTATION_KEYS = [
  'anchor',
  'commitment',
  'createdAt',
  'disclosures',
  'format',
  'formatVersion',
  'root',
  'schemaId',
  'signature',
  'subject',
].join(',')

class Refusal extends Error {
  constructor(readonly reason: PresentationFailure, detail: string) {
    super(detail)
  }
}

function refuse(reason: PresentationFailure, detail: string): never {
  throw new Refusal(reason, detail)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype
}

function keysOf(value: Record<string, unknown>): string {
  return Object.keys(value).sort().join(',')
}

function readSubject(did: unknown): Subject {
  if (typeof did !== 'string') refuse('MalformedPresentation', 'subject is a DID string')

  try {
    return parseSubject(did)
  } catch (error) {
    if (error instanceof ProfileError && error.code === 'UnsupportedSubjectScheme') {
      refuse('UnsupportedSubjectScheme', error.message)
    }

    return refuse('MalformedPresentation', error instanceof Error ? error.message : String(error))
  }
}

function readDisclosures(raw: unknown, subject: Subject, root: string): DisclosedField[] {
  if (!Array.isArray(raw)) refuse('MalformedPresentation', 'disclosures is a list')

  const seen = new Set<number>()
  const disclosed: DisclosedField[] = []

  for (const item of raw as unknown[]) {
    if (!isPlainObject(item) || keysOf(item) !== 'pointer,proof,salt,slot,value') {
      refuse('MalformedPresentation', 'A disclosure is { slot, pointer, value, salt, proof }')
    }

    const { slot, pointer, value, salt, proof } = item

    if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 0 || seen.has(slot)) {
      refuse('MalformedPresentation', `A disclosure names slot ${String(slot)}, which is invalid or repeated`)
    }

    const definition = slotDefinition(slot)

    if (!definition || slot >= FIRST_RESERVED_SLOT) {
      refuse('MalformedPresentation', `Slot ${slot} is reserved in schema v1 and cannot be disclosed`)
    }
    if (pointer !== definition.pointer) {
      refuse('MalformedPresentation', `Slot ${slot} is ${definition.pointer}, not ${String(pointer)}`)
    }
    if (!isCanonicalFieldValue(definition, value)) {
      refuse('MalformedPresentation', `The value of ${definition.pointer} is not in canonical form`)
    }
    if (!isBytes32(salt)) {
      refuse('MalformedPresentation', `The salt of ${definition.pointer} is not 32 bytes of lowercase hex`)
    }
    if (!Array.isArray(proof) || proof.length !== PROOF_LENGTH || !proof.every(isBytes32)) {
      refuse('MalformedPresentation', `The proof of ${definition.pointer} is not ${PROOF_LENGTH} lowercase bytes32`)
    }

    seen.add(slot)

    const leaf = profileLeaf({
      schemaId: SCHEMA_ID_V1,
      leafSubject: subject.leafSubject,
      slot,
      pointer: definition.pointer,
      valueJcs: canonicalJson(value),
      salt,
    })

    if (processProof(leaf, proof as string[]) !== root) {
      refuse('InvalidProof', `${definition.pointer} does not open against the root`)
    }

    disclosed.push({ slot, key: definition.key, pointer: definition.pointer, value: value as FieldValue })
  }

  return disclosed.sort((a, b) => a.slot - b.slot)
}

function readAnchor(raw: unknown, subject: Subject): { chainId: number; registry: string; version: number } {
  if (!isPlainObject(raw) || keysOf(raw) !== 'chainId,registry,version') {
    refuse('MalformedPresentation', 'anchor is { chainId, registry, version } or null')
  }

  const { chainId, registry, version } = raw

  if (typeof chainId !== 'number' || !Number.isSafeInteger(chainId) || chainId <= 0) {
    refuse('MalformedPresentation', 'anchor.chainId is a positive integer')
  }
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > 0xffffffff) {
    refuse('MalformedPresentation', 'anchor.version is a registry version, 1 or more')
  }

  let checksummed: string | null = null

  try {
    checksummed = typeof registry === 'string' ? getAddress(registry) : null
  } catch {
    checksummed = null
  }

  if (checksummed === null || checksummed !== registry) {
    refuse('MalformedPresentation', 'anchor.registry is an EIP-55 address')
  }
  if (subject.scheme !== 'eip155') {
    refuse('UnsupportedSubjectScheme', 'IdentityRegistry records only did:pkh:eip155 subjects; this one can only be self-signed')
  }
  if (subject.chainId !== chainId) {
    refuse('MalformedPresentation', `The subject names chain ${subject.chainId} but the anchor is on chain ${chainId}`)
  }

  return { chainId, registry: checksummed, version }
}

function check(document: unknown): PresentationCheck {
  if (!isPlainObject(document) || keysOf(document) !== PRESENTATION_KEYS) {
    refuse('MalformedPresentation', `A presentation has exactly the keys ${PRESENTATION_KEYS}`)
  }
  if (document.format !== PRESENTATION_FORMAT || document.formatVersion !== FORMAT_VERSION) {
    refuse('UnsupportedFormat', `Only ${PRESENTATION_FORMAT} v${FORMAT_VERSION} is understood`)
  }
  if (document.schemaId !== SCHEMA_ID_V1) {
    refuse('UnsupportedSchema', `Only profile schema ${SCHEMA_ID_V1} is understood, got ${String(document.schemaId)}`)
  }

  const subject = readSubject(document.subject)
  const root = document.root

  if (!isBytes32(root)) refuse('MalformedPresentation', 'root is 32 bytes of lowercase hex')
  if (!isTimestamp(document.createdAt)) refuse('MalformedPresentation', 'createdAt is ISO-8601 UTC with milliseconds')

  if (document.anchor !== null) {
    const anchor = readAnchor(document.anchor, subject)

    if (document.signature !== null) {
      refuse('MalformedPresentation', 'An anchored presentation carries no self-signature')
    }
    if (!isBytes32(document.commitment)) {
      refuse('MalformedPresentation', 'An anchored presentation carries its commitment as lowercase bytes32')
    }

    const disclosed = readDisclosures(document.disclosures, subject, root)
    const evm = subject as EvmSubject
    const expected = profileCommitment({
      chainId: anchor.chainId,
      registry: anchor.registry,
      subject: evm.address,
      schemaId: SCHEMA_ID_V1,
      root,
    })

    if (document.commitment !== expected) {
      refuse('CommitmentMismatch', 'The commitment is not profileCommitment(subject, schemaId, root) for this anchor')
    }

    return {
      ok: true,
      mode: 'anchored',
      subject: evm,
      root,
      commitment: expected,
      disclosed,
      registryCheck: {
        chainId: anchor.chainId,
        registry: anchor.registry,
        subject: evm.address,
        version: anchor.version,
        commitment: expected,
        schemaId: SCHEMA_ID_V1,
      },
    }
  }

  if (document.commitment !== null) {
    refuse('MalformedPresentation', 'A self-signed presentation has no registry commitment')
  }

  const signature = document.signature

  if (!isPlainObject(signature) || keysOf(signature) !== 'scheme,value' || typeof signature.value !== 'string') {
    refuse('MalformedPresentation', 'A presentation with no anchor carries signature { scheme, value }')
  }
  if (signature.scheme !== signatureSchemeFor(subject)) {
    refuse('MalformedPresentation', `A ${subject.scheme} subject signs with ${signatureSchemeFor(subject)}`)
  }

  const disclosed = readDisclosures(document.disclosures, subject, root)
  const message = selfSignedMessage({ schemaId: SCHEMA_ID_V1, subject: subject.did, root })

  if (!verifySelfSignature(subject, message, { scheme: signature.scheme as SelfSignature['scheme'], value: signature.value })) {
    refuse('SignatureInvalid', "The signature is not the subject's signature over this schema, subject and root")
  }

  return { ok: true, mode: 'self-signed', subject, root, disclosed, signer: subject.address }
}

/** Checks a presentation (object or JSON text) offline. Never throws on bad input: it returns a reason. */
export function verifyPresentationDocument(input: unknown): PresentationCheck {
  try {
    const document = typeof input === 'string' ? (JSON.parse(input) as unknown) : input

    return check(document)
  } catch (error) {
    if (error instanceof Refusal) return { ok: false, reason: error.reason, detail: error.message }

    return { ok: false, reason: 'MalformedPresentation', detail: error instanceof Error ? error.message : String(error) }
  }
}
