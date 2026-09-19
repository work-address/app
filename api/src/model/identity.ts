import type { ProfileExport, ProfilePresentation } from '@/vendor/identity'

/**
 * Where this instance anchors profile commitments, as GET /identity/config
 * answers anyone. Everything but `enabled` and `schemaIds` is null when
 * anchoring is not configured. The RPC URL is never part of it: it can carry
 * a provider key, and a verifier should use an endpoint it trusts itself.
 */
export interface IIdentityConfig {
  enabled: boolean
  chainId: number | null
  /** EIP-55, as a presentation's anchor must spell it. */
  registryAddress: string | null
  manifestUrl: string | null
  /** Profile schemas this service can check. */
  schemaIds: number[]
}

/**
 * `IdentityRegistry.Presentation`, in the contract's declaration order: the
 * chain's answer about one presented version.
 */
export enum EIdentityChainResult {
  UNPUBLISHED = 'Unpublished',
  VERSION_UNKNOWN = 'VersionUnknown',
  COMMITMENT_MISMATCH = 'CommitmentMismatch',
  SCHEMA_MISMATCH = 'SchemaMismatch',
  SUPERSEDED = 'Superseded',
  DEACTIVATED = 'Deactivated',
  CURRENT = 'Current',
}

/**
 * Why no chain answer could be had. None of these says anything about the
 * presentation itself: a verifier must never read them as a failed proof.
 */
export enum EIdentityUnavailable {
  /** This instance anchors nowhere, or not on the presentation's registry. */
  NOT_CONFIGURED = 'NotConfigured',
  /** The RPC endpoint failed or answered something unreadable. */
  RPC_UNAVAILABLE = 'RpcUnavailable',
  /** The RPC endpoint answers as another chain than the one configured. */
  WRONG_CHAIN = 'WrongChain',
}

/**
 * Why a presentation, or the export sent with it, was refused before any
 * chain was asked. The library's own reasons, plus the service's.
 */
export enum EIdentityRefusal {
  UNSUPPORTED_SUBJECT_SCHEME = 'UnsupportedSubjectScheme',
  MALFORMED_PRESENTATION = 'MalformedPresentation',
  UNSUPPORTED_FORMAT = 'UnsupportedFormat',
  UNSUPPORTED_SCHEMA = 'UnsupportedSchema',
  INVALID_PROOF = 'InvalidProof',
  COMMITMENT_MISMATCH = 'CommitmentMismatch',
  SIGNATURE_INVALID = 'SignatureInvalid',
  /** Self-signed: it proves authorship only, and the holder keeps it. */
  NOT_ANCHORED = 'NotAnchored',
  /** Anchored to a chain or registry this instance does not read. */
  WRONG_REGISTRY = 'WrongRegistry',
  /** Hosted custody was asked for and no export came with it. */
  EXPORT_REQUIRED = 'ExportRequired',
  /** Holder custody was asked for and an export came anyway. */
  EXPORT_NOT_EXPECTED = 'ExportNotExpected',
  /** The export is not a well-formed schema v1 private export. */
  INVALID_EXPORT = 'InvalidExport',
  /** The export does not rebuild this presentation's subject and root. */
  EXPORT_MISMATCH = 'ExportMismatch',
}

/**
 * Who keeps the salts of the fields a presentation does not disclose.
 *
 * - `hosted` (the default): this service stores the holder's private export
 *   too. That keeps every field hidden from chain observers - the commitment
 *   alone opens nothing - but not from the operator, who then holds every
 *   value and every salt and can open any field of the commitment.
 * - `holder`: only the presentation is stored, so the service holds the salts
 *   of the fields shown in public and nothing else; the export stays on the
 *   holder's device.
 */
export enum EIdentitySaltCustody {
  HOSTED = 'hosted',
  HOLDER = 'holder',
}

export interface IIdentityChainCheck {
  result: EIdentityChainResult
  /**
   * The subject's whole record is withdrawn. Carried beside `result` so an
   * old version of a withdrawn profile reads as withdrawn, not merely
   * out of date.
   */
  subjectDeactivated: boolean
}

export enum EIdentityChainEventKind {
  PUBLISHED = 'PUBLISHED',
  DEACTIVATED = 'DEACTIVATED',
}

/** One IdentityRegistry event for a subject: its version history. */
export interface IIdentityChainEvent {
  kind: EIdentityChainEventKind
  version: number
  /** Published only. */
  schemaId: number | null
  /** Published only. */
  commitment: string | null
  /** The block time the contract recorded, ISO-8601 UTC. */
  at: string
  blockNumber: number
  transactionHash: string
  logIndex: number
}

export interface IIdentityRegistryRef {
  registry: string
  subject: string
}

export interface IIdentityPresentationRef extends IIdentityRegistryRef {
  version: number
  commitment: string
  schemaId: number
}

/**
 * What the identity routes need from a chain: reads only. Nothing here can
 * send a transaction; the holder's own wallet publishes and withdraws.
 */
export interface IIdentityChain {
  chainId(): Promise<number>
  blockNumber(): Promise<number>
  /**
   * `IdentityRegistry.checkPresentation` at a block number, or at the
   * node's finalized block (null when the node has no such tag).
   */
  checkPresentation(
    ref: IIdentityPresentationRef,
    blockTag: number | 'finalized',
  ): Promise<IIdentityChainCheck | null>
  /** Every IdentityPublished and IdentityDeactivated for the subject. */
  history(
    ref: IIdentityRegistryRef,
    fromBlock: number,
    toBlock: number,
  ): Promise<IIdentityChainEvent[]>
}

/**
 * The chain's answer about the hosted presentation, checked when asked.
 * Either `result` or `unavailable` is set, never both.
 */
export interface IIdentityStatus {
  result: EIdentityChainResult | null
  subjectDeactivated: boolean | null
  /** The block the answer is for. */
  checkedAtBlock: number | null
  /** The node's finalized block gives the same answer. */
  finalized: boolean
  unavailable: EIdentityUnavailable | null
}

/** A holder's hosted presentation, and what the chain says about it now. */
export interface IIdentityView {
  /** The account's address, as stored. */
  address: string
  /** did:pkh:eip155:<chainId>:<EIP-55 address>. */
  subject: string
  /** The registry version the presentation is anchored as. */
  version: number
  presentation: ProfilePresentation
  status: IIdentityStatus
  /**
   * The subject's events on the registry, oldest first: derived from the
   * chain on every read, never stored here. Null when the chain could not be
   * read.
   */
  history: IIdentityChainEvent[] | null
}

/** The holder's own answer to a publish: the view, plus what is held. */
export interface IIdentityPublication extends IIdentityView {
  custody: EIdentitySaltCustody
}

/** The hosted identity columns on User, as the identity routes read them. */
export interface IHostedIdentity {
  presentation: ProfilePresentation
  version: number
  export: ProfileExport | null
}

/** What DELETE /user/identity removed, and what it could not. */
export interface IIdentityRemoval {
  /** A hosted presentation was there to remove. */
  removed: boolean
  /** A hosted private export was there to remove. */
  exportRemoved: boolean
  /** Always true: this service cannot touch the registry. */
  chainUnchanged: boolean
  message: string
}
