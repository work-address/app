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
  /**
   * Whether POST /user/identity/relay will send a holder's signed
   * publication or withdrawal and pay its gas. False unless anchoring is on
   * and an operator configured and funded a relayer key; the holder's own
   * transaction is offered either way.
   */
  relayEnabled: boolean
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

/**
 * The chain half of a view: everything one anonymous read costs the registry,
 * kept together because it is cached together (IdentityReadCache).
 */
export interface IIdentityChainRead {
  status: IIdentityStatus
  /**
   * The subject's events on the registry, oldest first. Null when the chain
   * could not be read - which is never cached, because a missing history is
   * an absent fact rather than an answer.
   */
  history: IIdentityChainEvent[] | null
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

/**
 * `IdentityRegistry.Operation`, in the contract's declaration order: the
 * index is the uint8 a relayed authorization signs, so this list is append
 * only, exactly as the contract's enum is.
 */
export enum EIdentityRelayOperation {
  PUBLISH = 'Publish',
  DEACTIVATE = 'Deactivate',
}

/**
 * Why POST /user/identity/relay sent nothing. Every one of them is decided
 * before the relayer spends gas: a request the chain would refuse is refused
 * here first.
 */
export enum EIdentityRelayRefusal {
  /** No relayer runs here (503): send the transaction from your own wallet. */
  RELAY_DISABLED = 'RelayDisabled',
  /** This account used its relayed publications for the day (429). */
  RATE_LIMITED = 'RateLimited',
  /**
   * The signature is not the subject's over exactly this operation, payload,
   * nonce and deadline (422): forged, made for another subject or payload,
   * or already used.
   */
  INVALID_AUTHORIZATION = 'InvalidAuthorization',
  /** The authorization's deadline has passed on chain (422). */
  AUTHORIZATION_EXPIRED = 'AuthorizationExpired',
  /**
   * The registry would revert it for its own reason (409), named in
   * `errors[0].error`: VersionConflict, AlreadyDeactivated, NotPublished...
   */
  CHAIN_REFUSED = 'ChainRefused',
  /** Another relayed action with the same nonce is on its way (409). */
  AUTHORIZATION_IN_FLIGHT = 'AuthorizationInFlight',
  /** It needs more gas than the relayer may spend on one call (503). */
  GAS_CAP = 'GasCap',
  /** The network's base fee is over what the relayer may pay (503). */
  FEE_CAP = 'FeeCap',
  /** The relayer could not send: unfunded, busy, or its RPC failed (503). */
  RELAYER_UNAVAILABLE = 'RelayerUnavailable',
}

/**
 * One relayed registry call, exactly as the subject signed it. The relayer
 * adds nothing to it: every argument the contract takes is here, and each
 * is covered by the subject's signature (the payload binds the commitment,
 * schema and expected version; the action binds the operation, subject,
 * nonce and deadline).
 */
export interface IIdentityRelayCall {
  operation: EIdentityRelayOperation
  /** EIP-55. */
  subject: string
  /** Publication only; null for a withdrawal. */
  commitment: string | null
  /** Publication only; null for a withdrawal. */
  schemaId: number | null
  /** For a withdrawal, 0 means whatever version is current. */
  expectedVersion: number
  /** Unix seconds; the contract refuses the call once the chain is past it. */
  deadline: number
  signature: string
}

/** What POST /user/identity/relay answers once the transaction is sent. */
export interface IIdentityRelayReceipt {
  operation: EIdentityRelayOperation
  subject: string
  /** The subject's authorization nonce the transaction consumes, in decimal. */
  nonce: string
  /** The address that sent it and pays its gas. */
  relayer: string
  transactionHash: string
}

/** Fee terms the chain quotes, per gas, in wei. */
export interface IIdentityRelayFees {
  baseFeePerGas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
}

/** What one relayed transaction is sent with. */
export interface IIdentityRelayGas {
  nonce: number
  gasLimit: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
}

/**
 * A dry run of the call at the latest block: the gas it needs, or the name
 * of the registry error it would revert with (null when the revert names
 * none this service knows).
 */
export type TIdentityRelaySimulation =
  | { gas: bigint }
  | { revert: string | null }

/** A transaction as the node knows it; `unknown` is dropped or never seen. */
export type TIdentityRelayTxState = 'pending' | 'mined' | 'reverted' | 'unknown'

/** A sent transaction: mined, reverted, or not mined yet (null). */
export type TIdentityRelayOutcome = 'mined' | 'reverted' | null

/**
 * The relayer's last send, as every replica reads it back: the nonce it
 * used and the transaction that carries it.
 */
export interface IIdentityRelayerLastSend {
  nonce: number
  txHash: string
}

/** A relayed authorization already on its way, by the subject nonce it uses. */
export interface IIdentityRelayInFlight {
  signature: string
  txHash: string
  relayer: string
}

/**
 * IdentityRegistry as the relayer sees it: the reads that decide whether a
 * relay is worth sending, and the one call it makes. Its key pays gas and
 * nothing else - the contract gives it no power over any record.
 */
export interface IIdentityRelayerChain {
  /** The relayer's own address, derived from its key. */
  readonly address: string
  chainId(): Promise<number>
  /** The latest block's timestamp: the chain's now. */
  latestTimestamp(): Promise<number>
  /** `IdentityRegistry.nonces(subject)`: the next authorization nonce. */
  subjectNonce(subject: string): Promise<bigint>
  simulate(call: IIdentityRelayCall): Promise<TIdentityRelaySimulation>
  fees(): Promise<IIdentityRelayFees>
  /** The relayer's native balance, in wei. */
  balance(): Promise<bigint>
  /** The relayer's transaction count including its pending ones. */
  pendingNonce(): Promise<number>
  /** What the node says of a transaction: waiting, mined, reverted or unheard of. */
  transactionState(txHash: string): Promise<TIdentityRelayTxState>
  /** Signs and broadcasts; resolves with the hash once the node took it. */
  send(call: IIdentityRelayCall, gas: IIdentityRelayGas): Promise<string>
  /** Waits up to `waitMs` for one confirmation. */
  outcome(txHash: string, waitMs: number): Promise<TIdentityRelayOutcome>
}

/**
 * Whether the relay runs here, as the identity config reports it. An
 * interface rather than the relayer's class, so the manager that reports it
 * does not depend on the service that sends.
 */
export interface IIdentityRelaySwitch {
  isEnabled(): boolean
}

/** Where a relay failure goes: Sentry in production, a list in a test. */
export type TIdentityRelayReporter = (error: unknown) => void
