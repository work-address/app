import { Interface, getAddress, keccak256, toUtf8Bytes, verifyMessage } from 'ethers'

import { canonicalJson } from './jcs'
import { escrowDeployment, readManifest } from './manifest'
import { failuresOf, qualificationsOf, verifyOrigin } from './origin'
import { RpcUnavailableError, blockOf, callAt, chainIdOf, logsOf } from './rpc'
import { evmSubject, parseSubject } from './subject'
import { isBytes32 } from './tree'

import type { ManifestDeployment, VerifierManifest } from './manifest'
import type { OriginCertificate, TermsOrigin } from './origin'
import type { BlockRef, RpcLog, RpcRequest } from './rpc'

/**
 * Qualified work receipts (SPEC section 5, ID-09).
 *
 * There is no receipts or reputation ledger on chain, by decision: the only
 * reputation fact a chain can attest is that one address was paid an amount
 * by another under known terms, and the escrow already emits exactly that, as
 * `Released`. A receipt is therefore not a credential anybody issues. It is a
 * reference: which chain, which escrow, which allocation, which event, and
 * what that event says. Anyone re-reads the event and the allocation with an
 * RPC endpoint of their own and sees whether the reference is true.
 *
 * What a verified receipt says: this wallet was paid this much, by that
 * wallet, through a listed escrow, for a period and under a terms hash the
 * chain records. What it does not say: that the work was good, that the two
 * wallets are independent people, or that anyone else would have paid for
 * it. A UI must keep that qualifier next to the number, and must never fold
 * receipts into a rating.
 *
 * The deployment manifest is the trust root. A copy of the escrow that its
 * own deployer funds emits a structurally perfect `Released`; nothing but
 * the manifest tells it from the real one, so an escrow the manifest does
 * not list is never asked anything.
 */

export const RECEIPT_FORMAT = 'work-address/settlement-receipt'
export const RECEIPT_FORMAT_VERSION = 1
export const RECEIPT_CLAIM_TYPE = 'escrow-release'

/** The domain line of the message a subject signs to present a receipt as theirs. */
export const RECEIPT_SIGNATURE_DOMAIN = 'work-address/settlement-receipt-presented/v1'

/** `MarketplaceEscrow.State`, in declaration order: `readAllocation`'s `state` n is entry n. */
export const ESCROW_STATES = ['None', 'Funded', 'Submitted', 'CancelledRefunded', 'ExpiredRefunded', 'DisputedRefunded', 'Released'] as const

export type EscrowState = (typeof ESCROW_STATES)[number]

/** The fragments of the escrow this module reads; the ABI fixture in contracts/test holds them to the compiled one. */
export const ESCROW_READ_ABI = [
  'function readAllocation(bytes32 allocationId) view returns ((address payer, address payee, uint256 budget, uint256 billed, uint256 workerTransferred, uint256 feeTransferred, uint256 clientRefunded, uint64 workStart, uint64 workEnd, uint64 submissionDeadline, uint64 releaseAt, uint8 state, bool remainderRefunded, bool earlySubmission, bytes32 obligationId, bytes32 termsHash, bytes32 invoiceCommitment))',
  'function token() view returns (address)',
  'function originSigner() view returns (address)',
  'event AllocationFunded(bytes32 indexed allocationId, bytes32 indexed obligationId, address indexed payer, address payee, uint256 budget, uint64 workStart, uint64 workEnd, uint64 submissionDeadline, bytes32 termsHash)',
  'event Released(bytes32 indexed allocationId, uint256 gross, uint256 workerNet, uint256 fee)',
] as const

const ESCROW = new Interface([...ESCROW_READ_ABI])
const TOKEN = new Interface(['function decimals() view returns (uint8)'])
const RELEASED_TOPIC = ESCROW.getEvent('Released')!.topicHash
const FUNDED_TOPIC = ESCROW.getEvent('AllocationFunded')!.topicHash

export type SettlementReceipt = {
  format: typeof RECEIPT_FORMAT
  formatVersion: typeof RECEIPT_FORMAT_VERSION
  claimType: typeof RECEIPT_CLAIM_TYPE
  /** did:pkh:eip155:<chainId>:<payee>: who was paid. */
  subject: string
  /** Who paid, EIP-55. Never the subject: a wallet paying itself earns no receipt. */
  payer: string
  source: { chainId: number; contract: string; allocationId: string; txHash: string; blockNumber: number; logIndex: number }
  /** Token base units as decimal strings. `gross = workerNet + fee`. */
  outcome: { gross: string; workerNet: string; fee: string; token: string; decimals: number }
  /** Unix seconds, as the allocation records them. */
  period: { workStart: number; workEnd: number }
  /** The commitment to the terms both sides accepted; an origin certificate opens it. */
  termsHash: string
  invoiceCommitment: string
  /** The finalized block the builder read this at; null when it read the head of a chain with no finality. */
  qualification: { finalizedAtBlock: number | null }
  /** The subject's own EIP-191 signature over `receiptMessage`, or null. It adds who presents it, not whether it is true. */
  signature: { scheme: 'eip191'; value: string } | null
}

/** What became of one allocation, as far as an earnings receipt is concerned. */
export type AllocationOutcome =
  /** Released to the subject: a receipt was built. */
  | 'Released'
  /** The money went back to the payer. Never an earnings receipt. */
  | 'CancelledBeforeWork'
  | 'ExpiredRefunded'
  | 'DisputeRefunded'
  /** Still held: funded, or billed and waiting. Nothing was paid yet. */
  | 'Funded'
  | 'Submitted'
  /** The escrow holds no such allocation, or no release of it. */
  | 'NotFound'
  /** It was released, to someone else. */
  | 'PayeeMismatch'
  /** Payer and payee are one wallet. */
  | 'SelfPaid'
  /** The event and the allocation disagree about what was paid. */
  | 'OutcomeMismatch'
  /** Released at the head, not yet in a finalized block. */
  | 'NotFinal'

export type AllocationReport = {
  allocationId: string
  contract: string
  outcome: AllocationOutcome
  detail: string
  /** Base units back with the payer, for the refund outcomes. */
  refunded: string | null
}

export type ReceiptBuild = {
  result: 'Built' | 'RegistryNotInManifest' | 'RpcUnavailable' | 'NotFinal'
  detail: string
  chainId: number | null
  /** The block every allocation was read at. */
  checkedAtBlock: number | null
  finalized: boolean
  receipts: SettlementReceipt[]
  /** One entry per distinct allocation asked about, receipts included. */
  allocations: AllocationReport[]
}

export type ReceiptResult =
  | 'Verified'
  /** The chain holds no such release: never there, or reorganised away. */
  | 'NotFound'
  /** The allocation exists and is not released: held, or refunded. */
  | 'NotReleased'
  /** The receipt names an escrow the manifest does not list. */
  | 'RegistryNotInManifest'
  /** The allocation was paid to another wallet than the receipt's subject, or the caller expected another subject. */
  | 'SubjectMismatch'
  /** An amount, the payer, the token, the period or a hash is not what the chain records. */
  | 'OutcomeMismatch'
  /** The origin certificate handed over with it contradicts the chain or itself. */
  | 'TermsMismatch'
  | 'MalformedReceipt'
  | 'SignatureInvalid'
  | 'RpcUnavailable'
  | 'NotFinal'

export type DisclosedTerms = {
  /** `opened`: the certificate's bytes hash to the chain's termsHash. `unproven`: see origin.ts. */
  disclosure: 'opened' | 'unproven'
  contractId: string
  origin: TermsOrigin | null
  /** Who signed the allocation's terms; equal to the escrow's own `originSigner()`. */
  signer: string
  qualifications: string[]
}

export type ReceiptReport = {
  result: ReceiptResult
  accepted: boolean
  detail: string
  receipt: SettlementReceipt | null
  checkedAtBlock: number | null
  finalized: boolean
  /** Set when a certificate was handed over and holds. */
  terms: DisclosedTerms | null
}

export type ChainOptions = {
  manifest: unknown
  rpc: RpcRequest
  /** `finalized` by default; `latest` for a development chain with no finality. */
  finality?: 'finalized' | 'latest'
  /** Most blocks per log request. */
  logRange?: number
}

type Allocation = {
  payer: string
  payee: string
  billed: bigint
  workerTransferred: bigint
  feeTransferred: bigint
  clientRefunded: bigint
  workStart: number
  workEnd: number
  state: EscrowState
  termsHash: string
  invoiceCommitment: string
  budget: bigint
}

type View = { chainId: number; latest: BlockRef; at: BlockRef; finalized: boolean }

class NotFinalYet extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype
}

function keysOf(value: Record<string, unknown>): string {
  return Object.keys(value).sort().join(',')
}

/** The block state is read at: the finalized one, or the head when the caller asked for the head. */
async function openChain(rpc: RpcRequest, expectedChainId: number | null, finality: 'finalized' | 'latest'): Promise<View> {
  const chainId = await chainIdOf(rpc)

  if (expectedChainId !== null && chainId !== expectedChainId) {
    throw new RpcUnavailableError('eth_chainId', `The endpoint serves chain ${chainId}, not chain ${expectedChainId}`)
  }

  const latest = await blockOf(rpc, 'latest')

  if (latest === null) throw new RpcUnavailableError('eth_getBlockByNumber', 'The endpoint has no latest block')
  if (finality === 'latest') return { chainId, latest, at: latest, finalized: false }

  const final = await blockOf(rpc, 'finalized')

  if (final === null) throw new NotFinalYet('The endpoint names no finalized block, so nothing it says is final')

  return { chainId, latest, at: final, finalized: true }
}

async function call(rpc: RpcRequest, to: string, abi: Interface, name: string, args: unknown[], block: number) {
  const returned = await callAt(rpc, to, abi.encodeFunctionData(name, args), block)

  if (returned === '0x') {
    throw new RpcUnavailableError('eth_call', `Nothing answers ${name} at ${to} on the chain this endpoint serves`)
  }

  try {
    return abi.decodeFunctionResult(name, returned)
  } catch {
    throw new RpcUnavailableError('eth_call', `${to} did not answer ${name} as the escrow does`)
  }
}

async function readAllocation(rpc: RpcRequest, escrow: string, allocationId: string, block: number): Promise<Allocation> {
  const [raw] = await call(rpc, escrow, ESCROW, 'readAllocation', [allocationId], block)
  const state = ESCROW_STATES[Number(raw.state)]

  if (state === undefined) {
    throw new RpcUnavailableError('eth_call', `${escrow} reports a state this verifier does not know: ${String(raw.state)}`)
  }

  return {
    payer: getAddress(raw.payer),
    payee: getAddress(raw.payee),
    budget: BigInt(raw.budget),
    billed: BigInt(raw.billed),
    workerTransferred: BigInt(raw.workerTransferred),
    feeTransferred: BigInt(raw.feeTransferred),
    clientRefunded: BigInt(raw.clientRefunded),
    workStart: Number(raw.workStart),
    workEnd: Number(raw.workEnd),
    state,
    termsHash: String(raw.termsHash).toLowerCase(),
    invoiceCommitment: String(raw.invoiceCommitment).toLowerCase(),
  }
}

async function tokenOf(rpc: RpcRequest, deployment: ManifestDeployment, escrow: string, block: number) {
  const [address] = await call(rpc, escrow, ESCROW, 'token', [], block)
  const token = getAddress(address)

  if (deployment.token !== null && deployment.token.address === token) return { token, decimals: deployment.token.decimals }

  const [decimals] = await call(rpc, token, TOKEN, 'decimals', [], block)

  return { token, decimals: Number(decimals) }
}

type Release = { log: RpcLog; gross: bigint; workerNet: bigint; fee: bigint }

function releaseOf(log: RpcLog): Release {
  const parsed = ESCROW.parseLog({ topics: log.topics, data: log.data })

  if (parsed === null) throw new RpcUnavailableError('eth_getLogs', 'The endpoint answered a log that is not Released')

  return { log, gross: BigInt(parsed.args.gross), workerNet: BigInt(parsed.args.workerNet), fee: BigInt(parsed.args.fee) }
}

/** The storage and the event must tell one story, and it must add up. */
function consistent(allocation: Allocation, release: Release): boolean {
  return (
    release.gross > BigInt(0) &&
    release.gross === allocation.billed &&
    release.workerNet === allocation.workerTransferred &&
    release.fee === allocation.feeTransferred &&
    release.workerNet + release.fee === release.gross
  )
}

const REFUNDS: Partial<Record<EscrowState, AllocationOutcome>> = {
  CancelledRefunded: 'CancelledBeforeWork',
  ExpiredRefunded: 'ExpiredRefunded',
  DisputedRefunded: 'DisputeRefunded',
}

const REFUND_DETAILS: Partial<Record<AllocationOutcome, string>> = {
  CancelledBeforeWork: 'The payer cancelled before the work began and was refunded in full. Nothing was earned',
  ExpiredRefunded: 'No bill was submitted in time and the payer was refunded. Nothing was earned',
  DisputeRefunded: 'The payer disputed the bill and was refunded. Nothing was earned',
}

function normalizeId(allocationId: string): string | null {
  const id = typeof allocationId === 'string' ? allocationId.toLowerCase() : ''

  return isBytes32(id) ? id : null
}

/**
 * Builds a receipt for every allocation of `allocationIds` that was released
 * to `subject` on a listed escrow, and says what became of each of the
 * others. An id listed twice is one allocation. `allocationIds` are hints
 * from anywhere, the marketplace's API included: every fact in a receipt is
 * read from the chain, so a wrong hint can only produce a `NotFound`.
 *
 * `escrow` names one escrow; without it, every escrow the manifest lists on
 * the endpoint's chain is tried for each id.
 */
export async function buildReceipts(
  input: { subject: string; allocationIds: readonly string[]; escrow?: string },
  options: ChainOptions,
): Promise<ReceiptBuild> {
  const manifest = readManifest(options.manifest)
  const empty: ReceiptBuild = { result: 'Built', detail: '', chainId: null, checkedAtBlock: null, finalized: false, receipts: [], allocations: [] }

  try {
    const view = await openChain(options.rpc, null, options.finality ?? 'finalized')
    const payee = evmSubject(input.subject, view.chainId)
    const deployments =
      input.escrow === undefined
        ? manifest.deployments.filter((entry) => entry.chainId === view.chainId && entry.escrow !== null)
        : [escrowDeployment(manifest, view.chainId, input.escrow)].filter((entry): entry is ManifestDeployment => entry !== null)

    if (deployments.length === 0) {
      return {
        ...empty,
        result: 'RegistryNotInManifest',
        chainId: view.chainId,
        detail:
          input.escrow === undefined
            ? `The manifest lists no escrow on chain ${view.chainId}`
            : `The manifest lists no escrow at ${input.escrow} on chain ${view.chainId}. A copy of the escrow emits the same events and proves nothing`,
      }
    }

    const ids = [...new Set(input.allocationIds.map((id) => normalizeId(id) ?? String(id)))]
    const build: ReceiptBuild = { ...empty, chainId: view.chainId, checkedAtBlock: view.at.number, finalized: view.finalized }

    for (const allocationId of ids) {
      if (normalizeId(allocationId) === null) {
        build.allocations.push({ allocationId, contract: '', outcome: 'NotFound', detail: 'Not a bytes32 allocation id', refunded: null })
        continue
      }

      let report: AllocationReport | null = null

      for (const deployment of deployments) {
        const found = await settle(options, view, deployment, payee.address, allocationId)

        if (found.receipt) build.receipts.push(found.receipt)
        if (report === null || found.report.outcome !== 'NotFound') report = found.report
        if (found.report.outcome !== 'NotFound') break
      }

      build.allocations.push(report!)
    }

    build.detail = `${build.receipts.length} of ${ids.length} allocations were released to ${payee.address}, as of ${view.finalized ? 'finalized' : 'head'} block ${view.at.number}`

    return build
  } catch (error) {
    if (error instanceof NotFinalYet) return { ...empty, result: 'NotFinal', detail: error.message }
    if (error instanceof RpcUnavailableError) return { ...empty, result: 'RpcUnavailable', detail: `${error.message}. This says nothing about the allocations` }

    throw error
  }
}

async function settle(
  options: ChainOptions,
  view: View,
  deployment: ManifestDeployment,
  payee: string,
  allocationId: string,
): Promise<{ report: AllocationReport; receipt: SettlementReceipt | null }> {
  const escrow = deployment.escrow as string
  const allocation = await readAllocation(options.rpc, escrow, allocationId, view.at.number)
  const say = (outcome: AllocationOutcome, detail: string, refunded: string | null = null) => ({
    report: { allocationId, contract: escrow, outcome, detail, refunded },
    receipt: null,
  })

  if (allocation.state !== 'Released') {
    const refund = REFUNDS[allocation.state]

    if (refund) return say(refund, REFUND_DETAILS[refund] as string, allocation.clientRefunded.toString())

    if (view.latest.number !== view.at.number) {
      const head = await readAllocation(options.rpc, escrow, allocationId, view.latest.number)

      if (head.state === 'Released') return say('NotFinal', `Released at head block ${view.latest.number}, which is not final yet`)
    }

    if (allocation.state === 'None') return say('NotFound', `${escrow} holds no such allocation`)

    return allocation.state === 'Funded'
      ? say('Funded', 'Funded and not billed yet. Nothing was paid')
      : say('Submitted', 'Billed and waiting for release. Nothing was paid yet')
  }

  if (allocation.payee !== payee) return say('PayeeMismatch', `It was released to ${allocation.payee}, not to ${payee}`)
  if (allocation.payer === allocation.payee) return say('SelfPaid', 'Payer and payee are one wallet. Paying yourself earns no receipt')

  const logs = await logsOf(
    options.rpc,
    { address: escrow, topics: [RELEASED_TOPIC, allocationId], fromBlock: deployment.deployBlock, toBlock: view.at.number },
    options.logRange,
  )

  if (logs.length === 0) return say('NotFound', `${escrow} reports the allocation released, but the endpoint holds no Released event for it`)
  if (logs.length > 1) return say('OutcomeMismatch', 'More than one Released event names this allocation, which the escrow cannot do')

  const release = releaseOf(logs[0])

  if (!consistent(allocation, release)) {
    return say('OutcomeMismatch', 'The Released event and the allocation disagree about what was paid')
  }

  const { token, decimals } = await tokenOf(options.rpc, deployment, escrow, view.at.number)
  const receipt: SettlementReceipt = {
    format: RECEIPT_FORMAT,
    formatVersion: RECEIPT_FORMAT_VERSION,
    claimType: RECEIPT_CLAIM_TYPE,
    subject: evmSubject(payee, view.chainId).did,
    payer: allocation.payer,
    source: {
      chainId: view.chainId,
      contract: escrow,
      allocationId,
      txHash: release.log.transactionHash,
      blockNumber: release.log.blockNumber,
      logIndex: release.log.logIndex,
    },
    outcome: { gross: release.gross.toString(), workerNet: release.workerNet.toString(), fee: release.fee.toString(), token, decimals },
    period: { workStart: allocation.workStart, workEnd: allocation.workEnd },
    termsHash: allocation.termsHash,
    invoiceCommitment: allocation.invoiceCommitment,
    qualification: { finalizedAtBlock: view.finalized ? view.at.number : null },
    signature: null,
  }

  return {
    report: { allocationId, contract: escrow, outcome: 'Released', detail: `Released ${release.workerNet} base units to ${payee}`, refunded: null },
    receipt,
  }
}

/**
 * Every allocation a listed escrow was ever funded with for `subject` as the
 * payee. `AllocationFunded` does not index the payee, so this reads every
 * funding event since the deployment block: the cost of asking nobody. The
 * marketplace's candidate route is the cheap alternative, and only a hint.
 */
export async function findAllocationsPaidTo(subject: string, options: ChainOptions & { escrow?: string }): Promise<string[]> {
  const manifest = readManifest(options.manifest)
  const view = await openChain(options.rpc, null, options.finality ?? 'finalized')
  const payee = getAddress(subject)
  const found = new Set<string>()

  for (const deployment of manifest.deployments) {
    if (deployment.chainId !== view.chainId || deployment.escrow === null) continue
    if (options.escrow !== undefined && getAddress(options.escrow) !== deployment.escrow) continue

    const logs = await logsOf(
      options.rpc,
      { address: deployment.escrow, topics: [FUNDED_TOPIC], fromBlock: deployment.deployBlock, toBlock: view.at.number },
      options.logRange,
    )

    for (const log of logs) {
      const parsed = ESCROW.parseLog({ topics: log.topics, data: log.data })

      if (parsed !== null && getAddress(parsed.args.payee) === payee) found.add(String(parsed.args.allocationId).toLowerCase())
    }
  }

  return [...found]
}

const RECEIPT_KEYS = 'claimType,format,formatVersion,invoiceCommitment,outcome,payer,period,qualification,signature,source,subject,termsHash'
const AMOUNT = /^(0|[1-9][0-9]*)$/

function isEip55(value: unknown): value is string {
  try {
    return typeof value === 'string' && getAddress(value) === value
  } catch {
    return false
  }
}

function isBlock(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

/** The receipt, if `input` is exactly one; otherwise the reason it is not. */
export function readReceipt(input: unknown): { receipt: SettlementReceipt } | { reason: string } {
  let document: unknown = input

  if (typeof input === 'string') {
    try {
      document = JSON.parse(input)
    } catch {
      return { reason: 'The receipt is not JSON' }
    }
  }

  if (!isRecord(document) || keysOf(document) !== RECEIPT_KEYS) return { reason: `A receipt has exactly the keys ${RECEIPT_KEYS}` }
  if (document.format !== RECEIPT_FORMAT || document.formatVersion !== RECEIPT_FORMAT_VERSION || document.claimType !== RECEIPT_CLAIM_TYPE) {
    return { reason: `Only ${RECEIPT_FORMAT} v${RECEIPT_FORMAT_VERSION} of claim type ${RECEIPT_CLAIM_TYPE} is understood` }
  }

  const { source, outcome, period, qualification, signature } = document

  if (
    !isRecord(source) ||
    keysOf(source) !== 'allocationId,blockNumber,chainId,contract,logIndex,txHash' ||
    !isBlock(source.chainId) ||
    source.chainId === 0 ||
    !isEip55(source.contract) ||
    !isBytes32(source.allocationId) ||
    !isBytes32(source.txHash) ||
    !isBlock(source.blockNumber) ||
    !isBlock(source.logIndex)
  ) {
    return { reason: 'source is { chainId, contract (EIP-55), allocationId, txHash (lowercase bytes32), blockNumber, logIndex }' }
  }
  if (
    !isRecord(outcome) ||
    keysOf(outcome) !== 'decimals,fee,gross,token,workerNet' ||
    ![outcome.gross, outcome.workerNet, outcome.fee].every((amount) => typeof amount === 'string' && AMOUNT.test(amount)) ||
    !isEip55(outcome.token) ||
    !isBlock(outcome.decimals)
  ) {
    return { reason: 'outcome is { gross, workerNet, fee (base units, decimal strings), token (EIP-55), decimals }' }
  }
  if (!isRecord(period) || keysOf(period) !== 'workEnd,workStart' || !isBlock(period.workStart) || !isBlock(period.workEnd)) {
    return { reason: 'period is { workStart, workEnd } in Unix seconds' }
  }
  if (
    !isRecord(qualification) ||
    keysOf(qualification) !== 'finalizedAtBlock' ||
    !(qualification.finalizedAtBlock === null || isBlock(qualification.finalizedAtBlock))
  ) {
    return { reason: 'qualification is { finalizedAtBlock }, a block number or null' }
  }
  if (!isBytes32(document.termsHash) || !isBytes32(document.invoiceCommitment) || !isEip55(document.payer)) {
    return { reason: 'termsHash and invoiceCommitment are lowercase bytes32, and payer is an EIP-55 address' }
  }
  if (
    signature !== null &&
    (!isRecord(signature) || keysOf(signature) !== 'scheme,value' || signature.scheme !== 'eip191' || typeof signature.value !== 'string')
  ) {
    return { reason: 'signature is { scheme: "eip191", value } or null' }
  }

  try {
    const subject = parseSubject(document.subject as string)

    if (subject.scheme !== 'eip155' || subject.chainId !== source.chainId) {
      return { reason: 'The subject is a did:pkh:eip155 account on the chain the receipt names' }
    }
  } catch (error) {
    return { reason: error instanceof Error ? error.message : 'The subject is not a DID' }
  }

  return { receipt: document as unknown as SettlementReceipt }
}

/** The exact text a subject signs to present a receipt as theirs: it commits to every other byte of it. */
export function receiptMessage(receipt: SettlementReceipt): string {
  const { signature: _signature, ...unsigned } = receipt

  return [
    'Work Address settlement receipt, presented by its subject',
    `domain: ${RECEIPT_SIGNATURE_DOMAIN}`,
    `subject: ${receipt.subject}`,
    `receipt: ${keccak256(toUtf8Bytes(canonicalJson(unsigned)))}`,
  ].join('\n')
}

function signedBySubject(receipt: SettlementReceipt): boolean {
  if (receipt.signature === null) return true

  try {
    const subject = parseSubject(receipt.subject)

    return verifyMessage(receiptMessage(receipt), receipt.signature.value) === subject.address
  } catch {
    return false
  }
}

/** The receipt with the subject's signature over `receiptMessage` attached; throws unless it is theirs. */
export function presentReceipt(receipt: SettlementReceipt, signature: string): SettlementReceipt {
  const presented: SettlementReceipt = { ...receipt, signature: { scheme: 'eip191', value: signature.toLowerCase() } }

  if (!signedBySubject(presented)) throw new TypeError("The signature is not the subject's signature of this receipt")

  return presented
}

/** The one text form of a receipt: RFC 8785 JCS. */
export function serializeReceipt(receipt: SettlementReceipt): string {
  return canonicalJson(receipt)
}

function sameEngagement(certificate: OriginCertificate, receipt: SettlementReceipt, allocation: Allocation): string | null {
  const disclosed = certificate.allocations.find((entry) => entry.allocationId.toLowerCase() === receipt.source.allocationId)

  if (!disclosed) return 'The certificate discloses no such allocation'
  if (disclosed.chainId !== receipt.source.chainId || getAddress(disclosed.escrowAddress) !== receipt.source.contract) {
    return 'The certificate is for another deployment'
  }
  if (
    disclosed.termsHash.toLowerCase() !== allocation.termsHash ||
    getAddress(disclosed.payer) !== allocation.payer ||
    getAddress(disclosed.payee) !== allocation.payee ||
    BigInt(disclosed.budget) !== allocation.budget ||
    Number(disclosed.workStart) !== allocation.workStart ||
    Number(disclosed.workEnd) !== allocation.workEnd
  ) {
    return 'The certificate signs other terms than the chain records for this allocation'
  }

  return null
}

/**
 * Checks one receipt against the chain. With `certificate`, the origin
 * certificate of the hire, it also opens the terms hash: the disclosed terms
 * are the ones this payment was made under, signed by the escrow's own
 * `originSigner()`, read from the chain rather than from the manifest.
 */
export async function verifyReceipt(
  input: unknown,
  options: ChainOptions & { expectedSubject?: string; certificate?: OriginCertificate },
): Promise<ReceiptReport> {
  const manifest: VerifierManifest = readManifest(options.manifest)
  const base: ReceiptReport = { result: 'MalformedReceipt', accepted: false, detail: '', receipt: null, checkedAtBlock: null, finalized: false, terms: null }
  const read = readReceipt(input)

  if ('reason' in read) return { ...base, detail: read.reason }

  const { receipt } = read
  const report = { ...base, receipt }
  const subject = parseSubject(receipt.subject)

  if (!signedBySubject(receipt)) {
    return { ...report, result: 'SignatureInvalid', detail: "The signature is not the subject's signature of this receipt" }
  }
  if (options.expectedSubject !== undefined && getAddress(options.expectedSubject) !== subject.address) {
    return { ...report, result: 'SubjectMismatch', detail: `The receipt is about ${subject.address}, not ${options.expectedSubject}` }
  }

  const deployment = escrowDeployment(manifest, receipt.source.chainId, receipt.source.contract)

  if (deployment === null) {
    return {
      ...report,
      result: 'RegistryNotInManifest',
      detail: `The manifest lists no escrow at ${receipt.source.contract} on chain ${receipt.source.chainId}. A copy of the escrow emits the same events and proves nothing`,
    }
  }

  try {
    const view = await openChain(options.rpc, receipt.source.chainId, options.finality ?? 'finalized')
    const checked = { ...report, checkedAtBlock: view.at.number, finalized: view.finalized }
    const { contract, allocationId, blockNumber } = receipt.source

    if (blockNumber > view.latest.number) {
      return { ...checked, result: 'NotFound', detail: `The chain this endpoint serves ends at block ${view.latest.number}; it holds no block ${blockNumber}` }
    }

    const logs = await logsOf(options.rpc, { address: contract, topics: [RELEASED_TOPIC, allocationId], fromBlock: blockNumber, toBlock: blockNumber })
    const log = logs.find((entry) => entry.transactionHash === receipt.source.txHash && entry.logIndex === receipt.source.logIndex)

    if (!log) {
      return {
        ...checked,
        result: 'NotFound',
        detail: `Block ${blockNumber} holds no such Released event. It was never there, or the chain was reorganised and the release with it`,
      }
    }
    if (blockNumber > view.at.number) {
      return { ...checked, result: 'NotFinal', detail: `The release is in block ${blockNumber}; the chain is final up to block ${view.at.number}. Check again later` }
    }

    const allocation = await readAllocation(options.rpc, contract, allocationId, view.at.number)

    if (allocation.state !== 'Released') {
      return { ...checked, result: 'NotReleased', detail: `The escrow holds this allocation as ${allocation.state}, not Released` }
    }
    if (allocation.payee !== subject.address) {
      return { ...checked, result: 'SubjectMismatch', detail: `The allocation was paid to ${allocation.payee}, not to the receipt's subject ${subject.address}` }
    }

    const release = releaseOf(log)
    const { token, decimals } = await tokenOf(options.rpc, deployment, contract, view.at.number)
    const claimed = receipt.outcome
    const differs =
      !consistent(allocation, release) ||
      allocation.payer === allocation.payee ||
      claimed.gross !== release.gross.toString() ||
      claimed.workerNet !== release.workerNet.toString() ||
      claimed.fee !== release.fee.toString() ||
      claimed.token !== token ||
      claimed.decimals !== decimals ||
      receipt.payer !== allocation.payer ||
      receipt.period.workStart !== allocation.workStart ||
      receipt.period.workEnd !== allocation.workEnd ||
      receipt.termsHash !== allocation.termsHash ||
      receipt.invoiceCommitment !== allocation.invoiceCommitment

    if (differs) {
      return { ...checked, result: 'OutcomeMismatch', detail: 'The receipt does not say what the Released event and the allocation say' }
    }

    let terms: DisclosedTerms | null = null

    if (options.certificate !== undefined) {
      const [signer] = await call(options.rpc, contract, ESCROW, 'originSigner', [], view.at.number)
      const opened = openTerms(options.certificate, receipt, allocation, getAddress(signer))

      if ('reason' in opened) return { ...checked, result: 'TermsMismatch', detail: opened.reason }

      terms = opened.terms
    }

    return {
      ...checked,
      result: 'Verified',
      accepted: true,
      terms,
      detail:
        `${allocation.payer} paid ${subject.address} ${claimed.workerNet} base units of ${token} through the escrow at ${contract}, ` +
        `as of ${view.finalized ? 'finalized' : 'head'} block ${view.at.number}. Payment is not proof of skill, nor that payer and payee are independent`,
    }
  } catch (error) {
    if (error instanceof NotFinalYet) return { ...report, result: 'NotFinal', detail: error.message }
    if (error instanceof RpcUnavailableError) return { ...report, result: 'RpcUnavailable', detail: `${error.message}. This says nothing about the receipt` }

    throw error
  }
}

function openTerms(
  certificate: OriginCertificate,
  receipt: SettlementReceipt,
  allocation: Allocation,
  chainSigner: string,
): { terms: DisclosedTerms } | { reason: string } {
  let verdict: ReturnType<typeof verifyOrigin>

  try {
    verdict = verifyOrigin(certificate)
  } catch (error) {
    return { reason: `The certificate cannot be read: ${error instanceof Error ? error.message : String(error)}` }
  }

  const failures = failuresOf(certificate, verdict, chainSigner)
  const mismatch = sameEngagement(certificate, receipt, allocation)

  if (mismatch !== null) return { reason: mismatch }
  if (failures.length > 0) return { reason: failures.join('; ') }

  const opened = verdict.allocations.find((entry) => entry.allocationId.toLowerCase() === receipt.source.allocationId)

  if (!opened || opened.termsDisclosure === 'undisclosed') return { reason: 'The certificate does not disclose the terms of this allocation' }

  return {
    terms: {
      disclosure: opened.termsDisclosure,
      contractId: verdict.contractId,
      origin: verdict.origin,
      signer: opened.signer,
      qualifications: qualificationsOf(verdict),
    },
  }
}

export type ReceiptSummary = {
  /** Distinct verified releases. */
  releases: number
  /** Receipts that repeat an allocation already counted. */
  duplicates: number
  /** One line per chain and token; amounts are base units as decimal strings. */
  totals: { chainId: number; token: string; decimals: number; releases: number; gross: string; workerNet: string; fee: string }[]
  /** The lowest block any of them was checked at; null with none. */
  checkedAtBlock: number | null
}

/** The certificate that discloses this receipt's allocation, if any of them does. */
function certificateFor(input: unknown, certificates: readonly OriginCertificate[]): OriginCertificate | undefined {
  const read = readReceipt(input)

  if ('reason' in read) return undefined

  return certificates.find(
    (certificate) =>
      Array.isArray(certificate?.allocations) &&
      certificate.allocations.some((entry) => String(entry?.allocationId).toLowerCase() === read.receipt.source.allocationId),
  )
}

/**
 * Checks a list of receipts and adds them up. An allocation counts once,
 * however many receipts name it: the same release shown twice is one
 * payment. Only `Verified` receipts are counted at all. Each receipt is
 * opened with whichever of `certificates` discloses its allocation.
 */
export async function verifyReceipts(
  inputs: readonly unknown[],
  options: ChainOptions & { expectedSubject?: string; certificates?: readonly OriginCertificate[] },
): Promise<{ reports: (ReceiptReport & { duplicate: boolean })[]; summary: ReceiptSummary }> {
  const seen = new Set<string>()
  const totals = new Map<string, ReceiptSummary['totals'][number]>()
  const reports: (ReceiptReport & { duplicate: boolean })[] = []
  let duplicates = 0
  let checkedAtBlock: number | null = null

  for (const input of inputs) {
    const report = await verifyReceipt(input, { ...options, certificate: certificateFor(input, options.certificates ?? []) })
    const receipt = report.receipt
    const key = receipt ? `${receipt.source.chainId}:${receipt.source.contract}:${receipt.source.allocationId}` : ''
    const duplicate = report.accepted && seen.has(key)

    reports.push({ ...report, duplicate })

    if (!report.accepted || receipt === null) continue
    if (duplicate) {
      duplicates += 1
      continue
    }

    seen.add(key)
    checkedAtBlock = checkedAtBlock === null ? report.checkedAtBlock : Math.min(checkedAtBlock, report.checkedAtBlock ?? checkedAtBlock)

    const line = `${receipt.source.chainId}:${receipt.outcome.token}`
    const total = totals.get(line) ?? {
      chainId: receipt.source.chainId,
      token: receipt.outcome.token,
      decimals: receipt.outcome.decimals,
      releases: 0,
      gross: '0',
      workerNet: '0',
      fee: '0',
    }

    totals.set(line, {
      ...total,
      releases: total.releases + 1,
      gross: (BigInt(total.gross) + BigInt(receipt.outcome.gross)).toString(),
      workerNet: (BigInt(total.workerNet) + BigInt(receipt.outcome.workerNet)).toString(),
      fee: (BigInt(total.fee) + BigInt(receipt.outcome.fee)).toString(),
    })
  }

  return { reports, summary: { releases: seen.size, duplicates, totals: [...totals.values()], checkedAtBlock } }
}
