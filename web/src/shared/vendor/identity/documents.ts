import { getAddress } from 'ethers'

import { EXPORT_FORMAT, FORMAT_VERSION, PRESENTATION_FORMAT, SCHEMA_ID_V1 } from './constants'
import { ProfileError } from './errors'
import { canonicalJson } from './jcs'
import { assembleProfileTree, committedField, proofFor } from './profile'
import { selfSignedMessage, signatureSchemeFor, verifySelfSignature } from './self-signed'
import { profileCommitment } from './tree'

import type { Filler, ProfileTree } from './profile'
import type { FieldKey, FieldValue } from './schema'
import type { SelfSignature } from './self-signed'

/** Where an anchored presentation's commitment is published: registry version `version` of the subject. */
export type Anchor = { chainId: number; registry: string; version: number }

export type Disclosure = { slot: number; pointer: string; value: FieldValue; salt: string; proof: string[] }

/**
 * What a holder shows: chosen fields only, each with its salt and 5-element
 * proof, bound to either a registry anchor (with the commitment) or the
 * subject's own signature, never both. Serialized with JCS.
 */
export type ProfilePresentation = {
  format: typeof PRESENTATION_FORMAT
  formatVersion: typeof FORMAT_VERSION
  schemaId: typeof SCHEMA_ID_V1
  subject: string
  anchor: Anchor | null
  root: string
  commitment: string | null
  signature: SelfSignature | null
  createdAt: string
  disclosures: Disclosure[]
}

/**
 * The holder's private backup: every value, salt and filler, enough to
 * rebuild the tree and present any field later. Anyone holding it can read
 * every field, so it must be kept like a key and never uploaded as it is.
 */
export type ProfileExport = {
  format: typeof EXPORT_FORMAT
  formatVersion: typeof FORMAT_VERSION
  schemaId: typeof SCHEMA_ID_V1
  subject: string
  root: string
  createdAt: string
  fields: { slot: number; pointer: string; value: FieldValue; salt: string }[]
  fillers: Filler[]
}

/** ISO-8601 UTC with milliseconds, as `Date.prototype.toISOString` writes it. */
export const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

export function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && TIMESTAMP.test(value) && new Date(value).toISOString() === value
}

function timestamp(createdAt: string | undefined): string {
  const value = createdAt ?? new Date().toISOString()

  if (!isTimestamp(value)) {
    throw new ProfileError('InvalidDocument', `createdAt is ISO-8601 UTC with milliseconds, got ${value}`)
  }

  return value
}

/** The one text form of a document: RFC 8785 JCS. */
export function serializeDocument(document: ProfilePresentation | ProfileExport): string {
  return canonicalJson(document)
}

export function createProfileExport(tree: ProfileTree, options: { createdAt?: string } = {}): ProfileExport {
  return {
    format: EXPORT_FORMAT,
    formatVersion: FORMAT_VERSION,
    schemaId: tree.schemaId,
    subject: tree.subject.did,
    root: tree.root,
    createdAt: timestamp(options.createdAt),
    fields: tree.fields.map(({ slot, pointer, value, salt }) => ({ slot, pointer, value, salt })),
    fillers: tree.fillers.map(({ slot, leaf }) => ({ slot, leaf })),
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype
}

function hasExactly(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).sort().join(',') === [...keys].sort().join(',')
}

/** Rebuilds the tree from a private export, and refuses it unless it reproduces the export's own root. */
export function restoreProfileTree(document: unknown): ProfileTree {
  let parsed: unknown = document

  if (typeof document === 'string') {
    try {
      parsed = JSON.parse(document)
    } catch {
      throw new ProfileError('InvalidDocument', 'The export is not JSON')
    }
  }

  if (
    !isPlainObject(parsed) ||
    !hasExactly(parsed, ['format', 'formatVersion', 'schemaId', 'subject', 'root', 'createdAt', 'fields', 'fillers']) ||
    parsed.format !== EXPORT_FORMAT ||
    parsed.formatVersion !== FORMAT_VERSION ||
    parsed.schemaId !== SCHEMA_ID_V1 ||
    typeof parsed.subject !== 'string' ||
    !isTimestamp(parsed.createdAt) ||
    !Array.isArray(parsed.fields) ||
    !Array.isArray(parsed.fillers)
  ) {
    throw new ProfileError('InvalidDocument', `Not a ${EXPORT_FORMAT} v${FORMAT_VERSION} document for schema ${SCHEMA_ID_V1}`)
  }

  const fields = parsed.fields.map((field: unknown) => {
    if (!isPlainObject(field) || !hasExactly(field, ['slot', 'pointer', 'value', 'salt'])) {
      throw new ProfileError('InvalidDocument', 'An export field is { slot, pointer, value, salt }')
    }

    return field as { slot: number; pointer: string; value: unknown; salt: string }
  })
  const fillers = parsed.fillers.map((filler: unknown) => {
    if (!isPlainObject(filler) || !hasExactly(filler, ['slot', 'leaf'])) {
      throw new ProfileError('InvalidDocument', 'An export filler is { slot, leaf }')
    }

    return filler as Filler
  })

  const tree = assembleProfileTree({ subject: parsed.subject, fields, fillers })

  if (tree.root !== parsed.root || tree.subject.did !== parsed.subject) {
    throw new ProfileError('RootMismatch', `The export's fields and fillers give root ${tree.root}, not ${String(parsed.root)}`)
  }

  return tree
}

function disclosures(tree: ProfileTree, disclose: readonly (FieldKey | number)[]): Disclosure[] {
  const chosen = new Map<number, Disclosure>()

  for (const which of disclose) {
    const field = committedField(tree, which)

    if (!field) {
      throw new ProfileError('NotDisclosable', `The tree holds no field ${String(which)}; its slot is a filler`)
    }

    chosen.set(field.slot, {
      slot: field.slot,
      pointer: field.pointer,
      value: field.value,
      salt: field.salt,
      proof: proofFor(tree, field.slot),
    })
  }

  return [...chosen.values()].sort((a, b) => a.slot - b.slot)
}

function checkAnchor(anchor: Anchor): Anchor {
  let registry: string

  try {
    registry = getAddress(anchor.registry)
  } catch {
    throw new ProfileError('InvalidDocument', `The anchor's registry is not an address: ${anchor.registry}`)
  }

  if (!Number.isSafeInteger(anchor.chainId) || anchor.chainId <= 0) {
    throw new ProfileError('InvalidDocument', `The anchor's chain id is a positive integer, got ${anchor.chainId}`)
  }
  if (!Number.isInteger(anchor.version) || anchor.version < 1 || anchor.version > 0xffffffff) {
    throw new ProfileError('InvalidDocument', `The anchor's version is a registry version (1 or more), got ${anchor.version}`)
  }

  return { chainId: anchor.chainId, registry, version: anchor.version }
}

/**
 * A presentation of `disclose` bound to the commitment published as
 * `anchor.version` of the subject's record. The subject must be an EVM
 * account on the anchor's chain. The caller publishes the commitment itself;
 * this makes no chain call.
 */
export function createAnchoredPresentation(
  tree: ProfileTree,
  options: { disclose: readonly (FieldKey | number)[]; anchor: Anchor; createdAt?: string },
): ProfilePresentation {
  const subject = tree.subject

  if (subject.scheme !== 'eip155') {
    throw new ProfileError(
      'UnsupportedSubjectScheme',
      'IdentityRegistry records only EVM accounts; a Solana subject presents in self-signed mode',
    )
  }

  const anchor = checkAnchor(options.anchor)

  if (anchor.chainId !== subject.chainId) {
    throw new ProfileError('InvalidDocument', `The subject names chain ${subject.chainId} but the anchor is on ${anchor.chainId}`)
  }

  return {
    format: PRESENTATION_FORMAT,
    formatVersion: FORMAT_VERSION,
    schemaId: tree.schemaId,
    subject: subject.did,
    anchor,
    root: tree.root,
    commitment: profileCommitment({
      chainId: anchor.chainId,
      registry: anchor.registry,
      subject: subject.address,
      schemaId: tree.schemaId,
      root: tree.root,
    }),
    signature: null,
    createdAt: timestamp(options.createdAt),
    disclosures: disclosures(tree, options.disclose),
  }
}

/** The message the subject's wallet signs for `createSelfSignedPresentation`. */
export function selfSignedMessageFor(tree: ProfileTree): string {
  return selfSignedMessage({ schemaId: tree.schemaId, subject: tree.subject.did, root: tree.root })
}

/**
 * A presentation with no anchor, bound by the subject's own signature over
 * `selfSignedMessageFor(tree)`. The signature is checked here, so a wrong key
 * fails now rather than in front of a verifier.
 */
export function createSelfSignedPresentation(
  tree: ProfileTree,
  options: { disclose: readonly (FieldKey | number)[]; signature: string; createdAt?: string },
): ProfilePresentation {
  const signature: SelfSignature = { scheme: signatureSchemeFor(tree.subject), value: options.signature.toLowerCase() }

  if (!verifySelfSignature(tree.subject, selfSignedMessageFor(tree), signature)) {
    throw new ProfileError('SignatureInvalid', `The signature is not the subject's ${signature.scheme} signature of this root`)
  }

  return {
    format: PRESENTATION_FORMAT,
    formatVersion: FORMAT_VERSION,
    schemaId: tree.schemaId,
    subject: tree.subject.did,
    anchor: null,
    root: tree.root,
    commitment: null,
    signature,
    createdAt: timestamp(options.createdAt),
    disclosures: disclosures(tree, options.disclose),
  }
}
