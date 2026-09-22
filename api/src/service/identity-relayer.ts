import * as Sentry from '@sentry/node'
import { Effect } from 'effect'
import {
  AbiCoder,
  getAddress,
  keccak256,
  parseUnits,
  verifyTypedData,
  Wallet,
} from 'ethers'
import { inject, injectable } from 'inversify'
import { BadRequestError, HttpError } from 'routing-controllers'

import { User } from '@/entity/user'
import AccessException from '@/exception/access-exception'
import IdentityRelayException from '@/exception/identity-relay-exception'
import { IConfigParameters } from '@/model/config'
import { IdentityRelayDto } from '@/model/dto/identity'
import {
  EIdentityRelayOperation,
  EIdentityRelayRefusal,
  IIdentityRelayCall,
  IIdentityRelayerChain,
  IIdentityRelayerLastSend,
  IIdentityRelayGas,
  IIdentityRelayInFlight,
  IIdentityRelayReceipt,
  IIdentityRelaySwitch,
  TIdentityRelayReporter,
} from '@/model/identity'
import { AdvisoryLock } from '@/service/advisory-lock'
import { fromPromise } from '@/service/effect-bridge'
import { IdentityManager } from '@/service/identity-manager'
import { IdentityRelayerChainFactory } from '@/service/identity-relayer-chain-factory'
import { RedisClient } from '@/service/redis-client'
import { WalletAddress } from '@/service/wallet-address'

/** Fee terms a relayed transaction is sent with. */
type TIdentityRelayFeeTerms = Pick<
  IIdentityRelayGas,
  'maxFeePerGas' | 'maxPriorityFeePerGas'
>

/**
 * Relays IdentityRegistry.publishFor and deactivateFor for holders whose
 * wallet holds no gas (WP-122, ID-07) - the in-browser wallet above all,
 * which is a key with no ETH. The holder signs an EIP-712 `Action` in their
 * own wallet; this service carries it and pays the gas, and that is all its
 * key can do: the registry takes the subject's signature as the only
 * consent, gives the relayer no power over any record, and the relayer
 * holds nothing but gas money.
 *
 * It never chooses what is signed. The request carries every argument the
 * contract takes, and before a single unit of gas is spent the signature is
 * recovered over exactly those arguments, at the subject's current nonce and
 * this chain and registry, and must be the caller's own address; then the
 * call is run dry (eth_estimateGas) so anything the registry would revert -
 * a stale version, a record already withdrawn, a replayed or expired
 * authorization - is refused by name instead of mined. Gas is capped twice,
 * as the escrow keeper caps it: a call estimated over
 * APP_IDENTITY_RELAYER_GAS_LIMIT is not sent, and nothing is sent while the
 * base fee is over APP_IDENTITY_RELAYER_MAX_FEE_GWEI.
 *
 * Publications are rationed per account per day, in Redis, so every replica
 * counts against the same ration. Withdrawals are never rationed: a takedown
 * is the one action that must not be losable, and the registry already
 * bounds them - each needs an active record, so there can be no more of
 * them than publications.
 *
 * Replicas share one key, so they share its transaction nonce. Sends are
 * serialised by a Postgres advisory lock on the relayer's address; inside
 * it the nonce is the node's pending count, raised past the last nonce any
 * replica sent (kept in Redis) while the node still knows that transaction,
 * so a node behind a load balancer that has not seen it yet cannot hand the
 * same nonce out twice - and a dropped one is reused rather than leaving a
 * gap. An authorization already on its way is remembered by the subject's
 * nonce, so the same request sent twice returns the same transaction
 * instead of paying for a second one that could only revert.
 *
 * Failures that are the relayer's rather than the request's - an
 * unreachable node, an unfunded key, fees over the cap, a relayed
 * transaction that reverted or was never mined - are reported like the
 * keeper's (Sentry in production), each once until it changes.
 *
 * Bound as a singleton: what it has reported and what it is still watching
 * live in it.
 */
@injectable()
export class IdentityRelayer implements IIdentityRelaySwitch {
  public static readonly DOMAIN_NAME = 'WorkAddressIdentityRegistry'

  public static readonly DOMAIN_VERSION = '1'

  /** IdentityRegistry.ACTION_TYPEHASH's struct, field for field. */
  public static readonly ACTION_TYPES = {
    Action: [
      { name: 'operation', type: 'uint8' },
      { name: 'subject', type: 'address' },
      { name: 'payload', type: 'bytes32' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint64' },
    ],
  }

  /** `IdentityRegistry.Operation` by its uint8 value. */
  public static readonly OPERATIONS: readonly EIdentityRelayOperation[] = [
    EIdentityRelayOperation.PUBLISH,
    EIdentityRelayOperation.DEACTIVATE,
  ]

  /** How long a sent relay is watched for its receipt before it is reported stuck. */
  public static readonly WAIT_MS = 120_000

  /** How long a send waits for another replica's send to finish. */
  public static readonly LOCK_WAIT_MS = 10_000

  /**
   * How long a sent authorization is remembered by its nonce. Past it, a
   * repeat of the request is judged by the chain alone - which by then has
   * mined it and moved the nonce, so the repeat no longer verifies.
   */
  public static readonly IN_FLIGHT_MS = 60 * 60_000

  private static readonly RATION_WINDOW_MS = 24 * 60 * 60_000

  /** An estimate plus this share is the gas limit a relay is sent with, up to the cap. */
  private static readonly GAS_MARGIN_PERCENT = BigInt(25)

  /** ethers' codes for a nonce another transaction already holds. */
  private static readonly NONCE_CLASH_CODES: ReadonlySet<string> = new Set([
    'NONCE_EXPIRED',
    'REPLACEMENT_UNDERPRICED',
  ])

  @inject('parameters')
  protected parameters: IConfigParameters

  @inject('RedisClient')
  protected redisClient: RedisClient

  @inject('AdvisoryLock')
  protected advisoryLock: AdvisoryLock

  @inject('IdentityRelayerChainFactory')
  protected chainFactory: IdentityRelayerChainFactory

  /** Where failures go; a test swaps it to read them. */
  public report: TIdentityRelayReporter = IdentityRelayer.reportFailure

  /** What was last reported about each subject, so it is reported once until it changes. */
  private readonly reported = new Map<string, string>()

  /** Receipts still being waited on. */
  private readonly watching = new Set<Promise<void>>()

  /** The relayer's address, or null when no usable key is configured. */
  public address(): string | null {
    return IdentityRelayer.keyAddress(this.parameters.identityRelayer.key)
  }

  /** Anchoring is configured and a relayer key is set: both, or no relay. */
  public isEnabled(): boolean {
    return (
      IdentityManager.isAnchoringConfigured(this.parameters.identity) &&
      this.address() !== null
    )
  }

  /**
   * POST /user/identity/relay. Sends `dto` for `user` and answers once the
   * node has taken the transaction, not once it is mined: the holder's
   * browser waits for the receipt through its own endpoint, and then hosts
   * the presentation with PUT /user/identity as after a direct publish.
   */
  public relay(
    user: User,
    dto: IdentityRelayDto,
  ): Effect.Effect<IIdentityRelayReceipt, unknown> {
    return fromPromise(() => this.relayNow(user, dto))
  }

  /** Resolves once every relay this instance sent has been mined, reverted or given up on. */
  public async settled(): Promise<void> {
    await Promise.all([...this.watching])
  }

  /** The address of a 32-byte hex private key, or null for anything else. */
  public static keyAddress(key: string): string | null {
    if (!/^(0x)?[\dA-Fa-f]{64}$/.test(key)) {
      return null
    }

    try {
      return new Wallet(key.startsWith('0x') ? key : `0x${key}`).address
    } catch {
      // Zero, or past the curve order: not a key.
      return null
    }
  }

  /**
   * The payload hash the registry binds into the action: publishPayload
   * (commitment, schema, expected version) or deactivatePayload (expected
   * version), encoded as the contract encodes them.
   */
  public static payload(call: IIdentityRelayCall): string {
    const coder = AbiCoder.defaultAbiCoder()

    return call.operation === EIdentityRelayOperation.PUBLISH
      ? keccak256(
          coder.encode(
            ['bytes32', 'uint32', 'uint32'],
            [call.commitment, call.schemaId, call.expectedVersion],
          ),
        )
      : keccak256(coder.encode(['uint32'], [call.expectedVersion]))
  }

  public static domain(chainId: number, registryAddress: string) {
    return {
      name: IdentityRelayer.DOMAIN_NAME,
      version: IdentityRelayer.DOMAIN_VERSION,
      chainId,
      verifyingContract: getAddress(registryAddress),
    }
  }

  /** The typed `Action` the subject signs for `call` at `nonce`. */
  public static action(call: IIdentityRelayCall, nonce: bigint) {
    return {
      operation: IdentityRelayer.OPERATIONS.indexOf(call.operation),
      subject: call.subject,
      payload: IdentityRelayer.payload(call),
      nonce,
      deadline: call.deadline,
    }
  }

  /** Who signed `call` at `nonce`, or null when the signature is malformed. */
  public static signer(
    call: IIdentityRelayCall,
    nonce: bigint,
    chainId: number,
    registryAddress: string,
  ): string | null {
    try {
      return verifyTypedData(
        IdentityRelayer.domain(chainId, registryAddress),
        IdentityRelayer.ACTION_TYPES,
        IdentityRelayer.action(call, nonce),
        call.signature,
      )
    } catch {
      return null
    }
  }

  /**
   * The nonce the relayer's next transaction takes. The node's pending
   * count, unless the last send any replica recorded is at or past it and
   * the node still knows that transaction: then the count is behind (a
   * node that has not seen it yet), and the next nonce is the one after it.
   * A recorded transaction the node no longer knows was dropped, and its
   * nonce is taken again rather than left as a gap nothing could pass.
   */
  public static nextNonce(
    pending: number,
    last: IIdentityRelayerLastSend | null,
    lastKnown: boolean,
  ): number {
    if (last === null || last.nonce < pending || !lastKnown) {
      return pending
    }

    return last.nonce + 1
  }

  private async relayNow(
    user: User,
    dto: IdentityRelayDto,
  ): Promise<IIdentityRelayReceipt> {
    if (!this.isEnabled()) {
      throw new IdentityRelayException(
        503,
        EIdentityRelayRefusal.RELAY_DISABLED,
        'No relayer runs on this instance: send the transaction from your own wallet',
      )
    }

    IdentityManager.assertAnchorable(user)

    const call = IdentityRelayer.callOf(dto)

    if (!WalletAddress.isSame(call.subject, user.address)) {
      throw new AccessException(
        'A relayed authorization is sent by its own subject only',
      )
    }

    try {
      if (call.operation === EIdentityRelayOperation.PUBLISH) {
        await this.ration(user)
      }

      return await this.relayChecked(call)
    } catch (error: unknown) {
      if (error instanceof HttpError) {
        throw error
      }

      // Another replica's send is taking longer than the wait: busy, not broken.
      if (!AdvisoryLock.isTimeout(error)) {
        this.report(error)
      }

      throw new IdentityRelayException(
        503,
        EIdentityRelayRefusal.RELAYER_UNAVAILABLE,
        'The relayer could not send this now; your own wallet still can',
      )
    }
  }

  /**
   * Every check that can refuse the request, cheapest first and all before
   * any gas is spent, then the send.
   */
  private async relayChecked(
    call: IIdentityRelayCall,
  ): Promise<IIdentityRelayReceipt> {
    const { chainId, registryAddress } = this.parameters.identity
    const chain = this.chain()
    const answered = await chain.chainId()

    if (answered !== chainId) {
      throw new Error(
        `IdentityRelayer: the identity RPC answers as chain ${answered}, but the relayer is configured for chain ${chainId}`,
      )
    }

    const [nonce, now] = await Promise.all([
      chain.subjectNonce(call.subject),
      chain.latestTimestamp(),
    ])

    // The next block is later than the latest one, so a deadline at the
    // latest block's time is already too late for any block it could be in.
    if (call.deadline <= now) {
      throw new IdentityRelayException(
        422,
        EIdentityRelayRefusal.AUTHORIZATION_EXPIRED,
        `The authorization's deadline (${call.deadline}) has passed on chain (${now}): sign it again`,
      )
    }

    const signer = IdentityRelayer.signer(
      call,
      nonce,
      chainId as number,
      registryAddress,
    )

    if (signer === null || !WalletAddress.isSame(signer, call.subject)) {
      throw new IdentityRelayException(
        422,
        EIdentityRelayRefusal.INVALID_AUTHORIZATION,
        `The signature is not ${call.subject}'s authorization of this ${call.operation} at nonce ${nonce}: it was made for another account, payload or deadline, or it has already been used`,
      )
    }

    const simulation = await chain.simulate(call)

    if ('revert' in simulation) {
      throw IdentityRelayer.refusalFor(simulation.revert)
    }

    const cap = BigInt(this.parameters.identityRelayer.gasLimit)

    if (simulation.gas > cap) {
      this.reportOnce(
        `gas:${call.operation}`,
        String(simulation.gas),
        new Error(
          `IdentityRelayer: a relayed ${call.operation} needs ${simulation.gas} gas, over APP_IDENTITY_RELAYER_GAS_LIMIT ${cap}; not sent`,
        ),
      )

      throw new IdentityRelayException(
        503,
        EIdentityRelayRefusal.GAS_CAP,
        'This action needs more gas than the relayer may spend on one call: send it from your own wallet',
      )
    }

    const fees = await this.feeTerms(chain)
    const margin =
      (simulation.gas * IdentityRelayer.GAS_MARGIN_PERCENT) / BigInt(100)
    const gasLimit =
      simulation.gas + margin < cap ? simulation.gas + margin : cap

    await this.assertFunded(chain, gasLimit * fees.maxFeePerGas)

    const txHash = await this.send(chain, call, nonce, { gasLimit, ...fees })

    return {
      operation: call.operation,
      subject: call.subject,
      nonce: nonce.toString(),
      relayer: chain.address,
      transactionHash: txHash,
    }
  }

  /**
   * Sends under the relayer's lock, with the nonce every replica agrees on,
   * and records it. A request whose authorization is already on its way is
   * answered with that transaction instead of a second one.
   */
  private send(
    chain: IIdentityRelayerChain,
    call: IIdentityRelayCall,
    subjectNonce: bigint,
    terms: Omit<IIdentityRelayGas, 'nonce'>,
  ): Promise<string> {
    const { chainId, registryAddress } = this.parameters.identity
    const relayer = chain.address.toLowerCase()
    const lastKey = `identity-relayer:last:${chainId}:${relayer}`
    const inFlightKey = `identity-relayer:sent:${chainId}:${registryAddress.toLowerCase()}:${call.subject.toLowerCase()}:${subjectNonce}`

    return this.advisoryLock.runSerially(
      `identity-relayer:${chainId}:${relayer}`,
      IdentityRelayer.LOCK_WAIT_MS,
      async () => {
        const inFlight = await this.inFlight(chain, inFlightKey)

        if (inFlight) {
          if (
            inFlight.signature.toLowerCase() !== call.signature.toLowerCase()
          ) {
            throw new IdentityRelayException(
              409,
              EIdentityRelayRefusal.AUTHORIZATION_IN_FLIGHT,
              `Another action ${call.subject} signed at nonce ${subjectNonce} is already on its way (${inFlight.txHash}): wait for it, then sign again`,
            )
          }

          return inFlight.txHash
        }

        const last = await this.lastSend(lastKey)
        const pending = await chain.pendingNonce()
        const lastKnown =
          last !== null &&
          last.nonce >= pending &&
          (await chain.transactionState(last.txHash)) !== 'unknown'
        let nonce = IdentityRelayer.nextNonce(pending, last, lastKnown)
        let txHash: string

        try {
          txHash = await chain.send(call, { nonce, ...terms })
        } catch (error: unknown) {
          if (!IdentityRelayer.isNonceClash(error)) {
            throw error
          }

          // Something outside this service sent from the key, or the record
          // is behind: the node's own count is the truth now.
          nonce = Math.max(await chain.pendingNonce(), nonce + 1)
          txHash = await chain.send(call, { nonce, ...terms })
        }

        const sent: IIdentityRelayInFlight = {
          signature: call.signature,
          txHash,
          relayer: chain.address,
        }

        await this.redisClient.set(lastKey, { nonce, txHash })
        await this.redisClient.setWithExpiry(
          inFlightKey,
          sent,
          IdentityRelayer.IN_FLIGHT_MS,
        )
        this.watch(chain, call, txHash)

        return txHash
      },
    )
  }

  /**
   * The relayed authorization recorded under `key`, while its transaction
   * is still waiting or mined. One the node dropped, or that reverted
   * without using the nonce, is no longer on its way.
   */
  private async inFlight(
    chain: IIdentityRelayerChain,
    key: string,
  ): Promise<IIdentityRelayInFlight | null> {
    const stored = (await this.redisClient.get(key)) as
      | IIdentityRelayInFlight
      | ''

    if (!stored) {
      return null
    }

    const state = await chain.transactionState(stored.txHash)

    return state === 'pending' || state === 'mined' ? stored : null
  }

  private async lastSend(
    key: string,
  ): Promise<IIdentityRelayerLastSend | null> {
    const stored = (await this.redisClient.get(key)) as
      | IIdentityRelayerLastSend
      | ''

    return stored && Number.isSafeInteger(stored.nonce) ? stored : null
  }

  /**
   * One more relayed publication for `user` today, or a 429 once the ration
   * is spent. 0 relays no publication at all.
   */
  private async ration(user: User): Promise<void> {
    const limit = this.parameters.identityRelayer.publishesPerDay
    const { count, ttlMs } = await this.redisClient.countWithin(
      `identity-relayer:publish:${user.id}`,
      IdentityRelayer.RATION_WINDOW_MS,
    )

    if (count <= limit) {
      return
    }

    // Rounded up, so a client that waits exactly this long finds it open.
    const retryAfterSeconds = Math.max(1, Math.ceil(ttlMs / 1000))

    throw new IdentityRelayException(
      429,
      EIdentityRelayRefusal.RATE_LIMITED,
      `This account has used its ${limit} relayed publications for the day. Try again in about ${Math.ceil(retryAfterSeconds / 3600)} hours, or publish from your own wallet.`,
      { retryAfterSeconds },
    )
  }

  /**
   * What the relay may pay per gas: the chain's own terms, never over the
   * cap. Refused, and reported once until fees fall, while the base fee
   * alone is over it.
   */
  private async feeTerms(
    chain: IIdentityRelayerChain,
  ): Promise<TIdentityRelayFeeTerms> {
    const fees = await chain.fees()
    const gwei = this.parameters.identityRelayer.maxFeeGwei
    // toFixed, not String: a small cap would print as 1e-7, which is not a number parseUnits reads.
    const cap = parseUnits(gwei.toFixed(9), 'gwei')

    if (fees.baseFeePerGas > cap) {
      this.reportOnce(
        'fees',
        'over-cap',
        new Error(
          `IdentityRelayer: the base fee is over APP_IDENTITY_RELAYER_MAX_FEE_GWEI ${gwei}; nothing is relayed until it falls`,
        ),
      )

      throw new IdentityRelayException(
        503,
        EIdentityRelayRefusal.FEE_CAP,
        'Network fees are over what the relayer may pay right now: try again later, or send it from your own wallet',
      )
    }

    this.reported.delete('fees')

    const maxFeePerGas = fees.maxFeePerGas < cap ? fees.maxFeePerGas : cap

    return {
      maxFeePerGas,
      maxPriorityFeePerGas:
        fees.maxPriorityFeePerGas < maxFeePerGas
          ? fees.maxPriorityFeePerGas
          : maxFeePerGas,
    }
  }

  /** Refuses, and reports once, while the key cannot pay for one relay. */
  private async assertFunded(
    chain: IIdentityRelayerChain,
    cost: bigint,
  ): Promise<void> {
    const balance = await chain.balance()

    if (balance >= cost) {
      this.reported.delete('balance')

      return
    }

    this.reportOnce(
      'balance',
      'short',
      new Error(
        `IdentityRelayer: ${chain.address} holds ${balance} wei, less than one relay may cost (${cost}); fund it or unset APP_IDENTITY_RELAYER_KEY`,
      ),
    )

    throw new IdentityRelayException(
      503,
      EIdentityRelayRefusal.RELAYER_UNAVAILABLE,
      'The relayer cannot pay for this right now: send it from your own wallet',
    )
  }

  /** Waits for the receipt in the background; a revert or a stuck send is reported. */
  private watch(
    chain: IIdentityRelayerChain,
    call: IIdentityRelayCall,
    txHash: string,
  ): void {
    const watching: Promise<void> = chain
      .outcome(txHash, IdentityRelayer.WAIT_MS)
      .then((outcome) => {
        if (outcome === 'mined') {
          return
        }

        this.reportOnce(
          `tx:${txHash}`,
          String(outcome),
          new Error(
            outcome === 'reverted'
              ? `IdentityRelayer: the relayed ${call.operation} for ${call.subject} reverted in ${txHash}`
              : `IdentityRelayer: the relayed ${call.operation} for ${call.subject} was not mined within ${IdentityRelayer.WAIT_MS / 1000}s (${txHash})`,
          ),
        )
      })
      .catch((error: unknown) => this.report(error))
      .finally(() => {
        this.watching.delete(watching)
      })

    this.watching.add(watching)
  }

  private chain(): IIdentityRelayerChain {
    const { rpcUrl, chainId, registryAddress } = this.parameters.identity

    return this.chainFactory.create(
      rpcUrl,
      chainId as number,
      registryAddress,
      this.parameters.identityRelayer.key,
    )
  }

  /** Reports `error` unless `subject` was last reported as `signature`. */
  private reportOnce(subject: string, signature: string, error: unknown): void {
    if (this.reported.get(subject) === signature) {
      return
    }

    this.reported.set(subject, signature)
    this.report(error)
  }

  /**
   * The call the request describes, with exactly the arguments its
   * operation takes: a publication carries a commitment and a schema, a
   * withdrawal carries neither - anything else is not something the
   * subject could have signed.
   */
  private static callOf(dto: IdentityRelayDto): IIdentityRelayCall {
    const publish = dto.operation === EIdentityRelayOperation.PUBLISH
    const hasPayload = dto.commitment !== undefined && dto.commitment !== null
    const hasSchema = dto.schemaId !== undefined && dto.schemaId !== null

    if (publish && (!hasPayload || !hasSchema)) {
      throw new BadRequestError(
        'A relayed publication carries the commitment and schema id it signs',
      )
    }

    if (!publish && (hasPayload || hasSchema)) {
      throw new BadRequestError(
        'A relayed withdrawal signs its expected version alone: send no commitment or schema id',
      )
    }

    return {
      operation: dto.operation,
      subject: getAddress(dto.subject),
      commitment: publish ? (dto.commitment as string).toLowerCase() : null,
      schemaId: publish ? (dto.schemaId as number) : null,
      expectedVersion: dto.expectedVersion,
      deadline: dto.deadline,
      signature: dto.signature,
    }
  }

  /** A dry run's revert, as the refusal the caller sees. */
  private static refusalFor(revert: string | null): IdentityRelayException {
    if (revert === 'InvalidAuthorization') {
      return new IdentityRelayException(
        422,
        EIdentityRelayRefusal.INVALID_AUTHORIZATION,
        "The registry does not accept this signature as the subject's authorization",
        { error: revert },
      )
    }

    if (revert === 'AuthorizationExpired') {
      return new IdentityRelayException(
        422,
        EIdentityRelayRefusal.AUTHORIZATION_EXPIRED,
        "The authorization's deadline has passed on chain: sign it again",
        { error: revert },
      )
    }

    const named = revert ? ` (${revert})` : ''

    return new IdentityRelayException(
      409,
      EIdentityRelayRefusal.CHAIN_REFUSED,
      `The registry would refuse this${named}: nothing was sent`,
      { error: revert },
    )
  }

  private static isNonceClash(error: unknown): boolean {
    const code = (error as { code?: unknown } | null)?.code

    return (
      typeof code === 'string' && IdentityRelayer.NONCE_CLASH_CODES.has(code)
    )
  }

  private static reportFailure(error: unknown): void {
    Sentry.captureException(error)
    console.error('IdentityRelayer failed', error)
  }
}
