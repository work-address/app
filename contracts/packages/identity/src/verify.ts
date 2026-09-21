import { Interface, getAddress } from 'ethers'

import { readManifest, registryDeployment } from './manifest'
import { RpcUnavailableError, blockOf, callAt, chainIdOf } from './rpc'
import { verifyPresentationDocument } from './verify-document'

import type { VerifierManifest } from './manifest'
import type { BlockRef, RpcRequest } from './rpc'
import type { DisclosedField, PresentationFailure, RegistryCheck } from './verify-document'

/**
 * The whole check of a presentation, by someone who trusts nothing but an RPC
 * endpoint of their own choosing and a deployment manifest: no Work Address
 * API is asked anything, and none could change the answer.
 *
 * Offline first: the shape, the schema, every disclosure's proof against the
 * root, and the commitment recomputed from the root (the registry stores
 * bytes it cannot open, so a verifier that trusted the stored commitment to
 * be well formed would be trusting the holder). Then the registry named by
 * the anchor is held to the manifest, and only then is the chain asked, with
 * `checkPresentation`, at the node's finalized block and again at its head.
 *
 * Every outcome is its own result. In particular an endpoint that cannot be
 * reached is `RpcUnavailable`, never a failed proof, and an answer the chain
 * has not finalized is `NotFinal`, never `Current`.
 */

/** `IdentityRegistry.Presentation`, in the declaration order the registry returns it in. */
export const CHAIN_RESULTS = [
  'Unpublished',
  'VersionUnknown',
  'CommitmentMismatch',
  'SchemaMismatch',
  'Superseded',
  'Deactivated',
  'Current',
] as const

export type ChainResult = (typeof CHAIN_RESULTS)[number]

export type VerificationResult =
  | ChainResult
  /** The document names a profile schema this verifier cannot read. */
  | 'UnsupportedSchema'
  /** The subject is not a did:pkh this verifier knows, or is one the registry cannot hold. */
  | 'UnsupportedSubjectScheme'
  /** The anchor names a registry the manifest does not list: a copy proves nothing. */
  | 'RegistryNotInManifest'
  /** A disclosed value, salt, slot or proof does not open against the root. */
  | 'InvalidProof'
  /** Not a presentation this verifier can read at all. */
  | 'MalformedExport'
  /** A valid wallet signature and no anchor: authorship, with no answer about currency or withdrawal. */
  | 'SelfSignedOnly'
  | 'SignatureInvalid'
  /** The document is about another account than the one the caller expected. */
  | 'SubjectMismatch'
  /** The endpoint could not answer. Not a statement about the document. */
  | 'RpcUnavailable'
  /** The chain's answer at its head differs from the one it has finalized, or nothing is finalized yet. */
  | 'NotFinal'

/** The registry's answer at one block. */
export type ChainAnswer = { block: number; blockHash: string; result: ChainResult; subjectDeactivated: boolean }

export type VerificationReport = {
  result: VerificationResult
  /** True for `Current` and `SelfSignedOnly` only; a caller that wants one bit reads this. */
  accepted: boolean
  detail: string
  mode: 'anchored' | 'self-signed' | null
  /** The subject's DID, once the document could be read that far. */
  subject: string | null
  /** The fields the document discloses. Empty unless every proof held. */
  disclosed: DisclosedField[]
  anchor: { chainId: number; registry: string; version: number } | null
  /**
   * The subject's whole record is withdrawn. Beside `result` rather than
   * inside it: an old version of a withdrawn profile is `Superseded` and
   * withdrawn, and must be shown as taken down, not as out of date.
   */
  subjectDeactivated: boolean | null
  /** The block the result is the registry's answer at; null when no chain was read. */
  checkedAtBlock: number | null
  /** That block is the node's finalized block. */
  finalized: boolean
  /** The answers behind a `NotFinal`, and behind any result that read both blocks. */
  atFinalized: ChainAnswer | null
  atLatest: ChainAnswer | null
}

export type VerifyOptions = {
  /** Deployments the verifier accepts (`readManifest` input). Needed for an anchored document. */
  manifest?: unknown
  /** Where to ask the chain. Needed for an anchored document. */
  rpc?: RpcRequest
  /** An address (EVM) or public key (Solana) the document must be about. */
  expectedSubject?: string
  /**
   * `finalized` (the default) accepts only what the node's finalized block
   * says. `latest` reads the head alone, for a development chain with no
   * finality; the report then says `finalized: false`.
   */
  finality?: 'finalized' | 'latest'
}

const REGISTRY = new Interface([
  'function checkPresentation(address subject, uint32 version, bytes32 commitment, uint32 schemaId) view returns (uint8 result, bool subjectDeactivated)',
])

const OFFLINE_RESULTS: Record<PresentationFailure, VerificationResult> = {
  MalformedPresentation: 'MalformedExport',
  UnsupportedFormat: 'MalformedExport',
  UnsupportedSchema: 'UnsupportedSchema',
  UnsupportedSubjectScheme: 'UnsupportedSubjectScheme',
  InvalidProof: 'InvalidProof',
  CommitmentMismatch: 'CommitmentMismatch',
  SignatureInvalid: 'SignatureInvalid',
}

const EMPTY: VerificationReport = {
  result: 'MalformedExport',
  accepted: false,
  detail: '',
  mode: null,
  subject: null,
  disclosed: [],
  anchor: null,
  subjectDeactivated: null,
  checkedAtBlock: null,
  finalized: false,
  atFinalized: null,
  atLatest: null,
}

function sameAccount(expected: string, actual: string): boolean {
  try {
    return getAddress(expected) === getAddress(actual)
  } catch {
    return expected === actual
  }
}

async function answerAt(rpc: RpcRequest, check: RegistryCheck, block: BlockRef): Promise<ChainAnswer> {
  const data = REGISTRY.encodeFunctionData('checkPresentation', [check.subject, check.version, check.commitment, check.schemaId])
  const returned = await callAt(rpc, check.registry, data, block.number)

  if (returned === '0x') {
    throw new RpcUnavailableError(
      'eth_call',
      `Nothing answers at ${check.registry} on the chain this endpoint serves, although the manifest lists a registry there`,
    )
  }

  let decoded: ReturnType<Interface['decodeFunctionResult']>

  try {
    decoded = REGISTRY.decodeFunctionResult('checkPresentation', returned)
  } catch {
    throw new RpcUnavailableError('eth_call', `${check.registry} did not answer checkPresentation as IdentityRegistry does`)
  }

  const result = CHAIN_RESULTS[Number(decoded[0])]

  if (result === undefined) {
    throw new RpcUnavailableError('eth_call', `${check.registry} answered a result this verifier does not know: ${String(decoded[0])}`)
  }

  return { block: block.number, blockHash: block.hash, result, subjectDeactivated: Boolean(decoded[1]) }
}

function describe(answer: ChainAnswer): string {
  return `${answer.result}${answer.subjectDeactivated ? ' (the subject has withdrawn the profile)' : ''} at block ${answer.block}`
}

const CHAIN_DETAILS: Record<ChainResult, string> = {
  Current: "This is the subject's current published version, and it stands",
  Superseded: 'The subject has published a newer version since this one',
  Deactivated: 'This was the current version when the subject withdrew the profile',
  Unpublished: 'The subject has never published to this registry',
  VersionUnknown: 'The registry holds no such version for the subject',
  CommitmentMismatch: 'The registry holds another commitment as this version',
  SchemaMismatch: 'The registry holds this commitment under another schema',
}

async function readChain(
  rpc: RpcRequest,
  check: RegistryCheck,
  finality: 'finalized' | 'latest',
): Promise<Pick<VerificationReport, 'result' | 'detail' | 'subjectDeactivated' | 'checkedAtBlock' | 'finalized' | 'atFinalized' | 'atLatest'>> {
  const served = await chainIdOf(rpc)

  if (served !== check.chainId) {
    throw new RpcUnavailableError('eth_chainId', `The endpoint serves chain ${served}; the document is anchored on chain ${check.chainId}`)
  }

  const latest = await blockOf(rpc, 'latest')

  if (latest === null) throw new RpcUnavailableError('eth_getBlockByNumber', 'The endpoint has no latest block')

  const final = finality === 'finalized' ? await blockOf(rpc, 'finalized') : null
  const atLatest = await answerAt(rpc, check, latest)

  if (finality === 'latest') {
    return {
      result: atLatest.result,
      detail: `${CHAIN_DETAILS[atLatest.result]}, as of head block ${latest.number}; finality was not asked for`,
      subjectDeactivated: atLatest.subjectDeactivated,
      checkedAtBlock: latest.number,
      finalized: false,
      atFinalized: null,
      atLatest,
    }
  }

  if (final === null) {
    return {
      result: 'NotFinal',
      detail: `The endpoint names no finalized block. At its head the registry says ${describe(atLatest)}, which may still change`,
      subjectDeactivated: atLatest.subjectDeactivated,
      checkedAtBlock: latest.number,
      finalized: false,
      atFinalized: null,
      atLatest,
    }
  }

  const atFinalized = final.number === latest.number ? { ...atLatest } : await answerAt(rpc, check, final)

  if (atFinalized.result !== atLatest.result || atFinalized.subjectDeactivated !== atLatest.subjectDeactivated) {
    return {
      result: 'NotFinal',
      detail: `The registry says ${describe(atFinalized)}, its finalized block, and ${describe(atLatest)}, its head. The newer answer is not final yet; check again later`,
      subjectDeactivated: atLatest.subjectDeactivated || atFinalized.subjectDeactivated,
      checkedAtBlock: final.number,
      finalized: false,
      atFinalized,
      atLatest,
    }
  }

  return {
    result: atFinalized.result,
    detail: `${CHAIN_DETAILS[atFinalized.result]}, as of finalized block ${final.number}`,
    subjectDeactivated: atFinalized.subjectDeactivated,
    checkedAtBlock: final.number,
    finalized: true,
    atFinalized,
    atLatest,
  }
}

/**
 * Checks a presentation (object or JSON text). Never throws on a bad
 * document or a bad endpoint: both are results. It throws `ManifestError`
 * for a manifest it cannot read, because that is the caller's own
 * configuration and no result could be trusted under it.
 */
export async function verifyPresentation(input: unknown, options: VerifyOptions = {}): Promise<VerificationReport> {
  const manifest: VerifierManifest | null = options.manifest === undefined ? null : readManifest(options.manifest)
  const offline = verifyPresentationDocument(input)

  if (!offline.ok) {
    return { ...EMPTY, result: OFFLINE_RESULTS[offline.reason], detail: offline.detail }
  }

  const base: VerificationReport = { ...EMPTY, mode: offline.mode, subject: offline.subject.did, disclosed: offline.disclosed }

  if (options.expectedSubject !== undefined && !sameAccount(options.expectedSubject, offline.subject.address)) {
    return {
      ...base,
      disclosed: [],
      result: 'SubjectMismatch',
      detail: `The document is about ${offline.subject.address}, not ${options.expectedSubject}`,
    }
  }

  if (offline.mode === 'self-signed') {
    return {
      ...base,
      result: 'SelfSignedOnly',
      accepted: true,
      detail:
        'The subject signed these fields. No registry anchors them, so nothing says whether a newer version exists or whether they were withdrawn',
    }
  }

  const check = offline.registryCheck
  const anchored: VerificationReport = {
    ...base,
    anchor: { chainId: check.chainId, registry: check.registry, version: check.version },
  }

  if (manifest === null || registryDeployment(manifest, check.chainId, check.registry) === null) {
    return {
      ...anchored,
      result: 'RegistryNotInManifest',
      detail: `The manifest lists no identity registry at ${check.registry} on chain ${check.chainId}. A copy of the registry runs the same scheme and proves nothing`,
    }
  }

  if (options.rpc === undefined) {
    return { ...anchored, result: 'RpcUnavailable', detail: 'No RPC endpoint was given, so the registry was not asked' }
  }

  try {
    const chain = await readChain(options.rpc, check, options.finality ?? 'finalized')

    return { ...anchored, ...chain, accepted: chain.result === 'Current' }
  } catch (error) {
    if (!(error instanceof RpcUnavailableError)) throw error

    return { ...anchored, result: 'RpcUnavailable', detail: `${error.message}. This says nothing about the document` }
  }
}

/** A withdrawn profile, however the registry phrased it: the view a UI must not soften into "out of date". */
export function isWithdrawn(report: Pick<VerificationReport, 'result' | 'subjectDeactivated'>): boolean {
  return report.result === 'Deactivated' || report.subjectDeactivated === true
}
