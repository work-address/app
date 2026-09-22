import { id, parseEther, parseUnits, Wallet } from 'ethers'

import {
  EIdentityRelayOperation,
  IIdentityRelayCall,
  IIdentityRelayerChain,
  IIdentityRelayFees,
  IIdentityRelayGas,
  TIdentityRelayOutcome,
  TIdentityRelaySimulation,
  TIdentityRelayTxState,
} from '@/model/identity'

interface IFakeHead {
  version: number
  active: boolean
}

interface IFakeTx {
  hash: string
  call: IIdentityRelayCall
  gas: IIdentityRelayGas
  state: TIdentityRelayTxState
}

/**
 * IdentityRegistry and a node as the relayer sees them, in memory, for the
 * controller tests that cannot reach a chain. The registry half keeps the
 * contract's rules the relayer's dry run depends on - the subject's nonce,
 * which moves only when a relayed call is mined, and the version and status
 * checks publish and deactivate revert on. It does not check signatures:
 * that is the relayer's own job, done before it ever asks the chain, and
 * the node suite checks the real contract doing it too.
 *
 * The node half is the relayer's mempool. A nonce already taken is refused
 * as ethers refuses it (NONCE_EXPIRED) and counted in `nonceClashes`;
 * `automine` off keeps sends pending; `pendingLag` makes the pending count
 * ignore what is not mined yet, as a node behind a load balancer that has
 * not seen a transaction answers.
 */
export class IdentityRelayerChainFake implements IIdentityRelayerChain {
  public readonly address: string

  public reportedChainId: number

  /** The latest block's timestamp. */
  public now = 1_900_000_000

  public gas = BigInt(120_000)

  public quotedFees: IIdentityRelayFees = {
    baseFeePerGas: parseUnits('1', 'gwei'),
    maxFeePerGas: parseUnits('3', 'gwei'),
    maxPriorityFeePerGas: parseUnits('1', 'gwei'),
  }

  public relayerBalance = parseEther('1')

  public automine = true

  public pendingLag = false

  /** What a sent transaction ends as, once mined. */
  public minedAs: 'mined' | 'reverted' = 'mined'

  /** Makes every dry run revert with this error name. */
  public forcedRevert: string | null | undefined = undefined

  /** Makes every read fail like an unreachable endpoint. */
  public down = false

  public nonceClashes = 0

  public readonly txs = new Map<string, IFakeTx>()

  private readonly subjectNonces = new Map<string, bigint>()
  private readonly heads = new Map<string, IFakeHead>()
  private readonly usedNonces = new Set<number>()
  private minedCount = 0
  private sends = 0

  constructor(chainId: number, address = Wallet.createRandom().address) {
    this.address = address
    this.reportedChainId = chainId
  }

  /** Every transaction sent, in the order the node took them. */
  public get sent(): IFakeTx[] {
    return [...this.txs.values()]
  }

  public async chainId(): Promise<number> {
    this.assertUp()

    return this.reportedChainId
  }

  public async latestTimestamp(): Promise<number> {
    this.assertUp()

    return this.now
  }

  public async subjectNonce(subject: string): Promise<bigint> {
    this.assertUp()

    return this.subjectNonces.get(subject.toLowerCase()) ?? BigInt(0)
  }

  public async simulate(
    call: IIdentityRelayCall,
  ): Promise<TIdentityRelaySimulation> {
    this.assertUp()

    if (this.forcedRevert !== undefined) {
      return { revert: this.forcedRevert }
    }

    const revert = this.revertOf(call)

    return revert === null ? { gas: this.gas } : { revert }
  }

  public async fees(): Promise<IIdentityRelayFees> {
    this.assertUp()

    return this.quotedFees
  }

  public async balance(): Promise<bigint> {
    this.assertUp()

    return this.relayerBalance
  }

  public async pendingNonce(): Promise<number> {
    this.assertUp()

    return this.pendingLag ? this.minedCount : this.usedNonces.size
  }

  public async transactionState(
    txHash: string,
  ): Promise<TIdentityRelayTxState> {
    this.assertUp()

    return this.txs.get(txHash)?.state ?? 'unknown'
  }

  public async send(
    call: IIdentityRelayCall,
    gas: IIdentityRelayGas,
  ): Promise<string> {
    this.assertUp()

    if (this.usedNonces.has(gas.nonce)) {
      this.nonceClashes += 1

      throw Object.assign(new Error('nonce too low'), { code: 'NONCE_EXPIRED' })
    }

    this.sends += 1

    const hash = id(`fake-relay:${this.address}:${this.sends}`)

    this.usedNonces.add(gas.nonce)
    this.txs.set(hash, { hash, call, gas, state: 'pending' })

    if (this.automine) {
      this.mine(hash)
    }

    return hash
  }

  /**
   * Waits, as a node's receipt poll does, until the transaction is mined or
   * reverted - or `waitMs`, capped at two seconds so a suite that leaves one
   * pending is not held for the relayer's full wait.
   */
  public async outcome(
    txHash: string,
    waitMs: number,
  ): Promise<TIdentityRelayOutcome> {
    const until = Date.now() + Math.min(waitMs, 2000)

    for (;;) {
      const state = this.txs.get(txHash)?.state

      if (state === 'mined' || state === 'reverted') {
        return state
      }

      if (state === undefined || Date.now() >= until) {
        return null
      }

      await new Promise((resolve) => setTimeout(resolve, 5))
    }
  }

  /** Mines one pending transaction, or all of them. */
  public mine(txHash?: string): void {
    for (const [hash, tx] of this.txs) {
      if (tx.state !== 'pending' || (txHash && hash !== txHash)) {
        continue
      }

      this.minedCount += 1

      if (this.minedAs === 'reverted' || this.revertOf(tx.call) !== null) {
        tx.state = 'reverted'

        continue
      }

      this.apply(tx.call)
      tx.state = 'mined'
    }
  }

  /** Forgets a pending transaction as a node that dropped it would. */
  public drop(txHash: string): void {
    const tx = this.txs.get(txHash)

    if (tx?.state === 'pending') {
      this.txs.delete(txHash)
      this.usedNonces.delete(tx.gas.nonce)
    }
  }

  /** A record the subject published with their own wallet. */
  public publishDirectly(subject: string): void {
    const key = subject.toLowerCase()
    const head = this.heads.get(key) ?? { version: 0, active: false }

    this.heads.set(key, { version: head.version + 1, active: true })
  }

  public versionCount(subject: string): number {
    return this.heads.get(subject.toLowerCase())?.version ?? 0
  }

  public isActive(subject: string): boolean {
    return this.heads.get(subject.toLowerCase())?.active ?? false
  }

  /** The contract's own order of checks for each relayed call. */
  private revertOf(call: IIdentityRelayCall): string | null {
    const head = this.heads.get(call.subject.toLowerCase()) ?? {
      version: 0,
      active: false,
    }

    if (call.deadline < this.now) {
      return 'AuthorizationExpired'
    }

    if (call.operation === EIdentityRelayOperation.PUBLISH) {
      return call.expectedVersion === head.version ? null : 'VersionConflict'
    }

    if (head.version === 0) {
      return 'NotPublished'
    }

    if (!head.active) {
      return 'AlreadyDeactivated'
    }

    return call.expectedVersion === 0 || call.expectedVersion === head.version
      ? null
      : 'VersionConflict'
  }

  private apply(call: IIdentityRelayCall): void {
    const key = call.subject.toLowerCase()
    const nonce = this.subjectNonces.get(key) ?? BigInt(0)
    const head = this.heads.get(key) ?? { version: 0, active: false }

    this.subjectNonces.set(key, nonce + BigInt(1))

    if (call.operation === EIdentityRelayOperation.PUBLISH) {
      this.heads.set(key, { version: head.version + 1, active: true })

      return
    }

    // Withdrawal consumes one more nonce: it voids what was signed before it.
    this.subjectNonces.set(key, nonce + BigInt(2))
    this.heads.set(key, { version: head.version, active: false })
  }

  private assertUp(): void {
    if (this.down) {
      throw new Error('connect ECONNREFUSED 127.0.0.1:8545')
    }
  }
}
