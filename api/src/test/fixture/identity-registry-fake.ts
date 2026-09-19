import {
  EIdentityChainEventKind,
  EIdentityChainResult,
  IIdentityChain,
  IIdentityChainCheck,
  IIdentityChainEvent,
  IIdentityPresentationRef,
  IIdentityRegistryRef,
} from '@/model/identity'

interface IHead {
  version: number
  status: 'None' | 'Active' | 'Deactivated'
}

interface IVersion {
  commitment: string
  schemaId: number
}

/**
 * IdentityRegistry's state machine in memory, for the controller tests that
 * cannot reach a chain: publish and deactivate with the contract's rules,
 * and checkPresentation, the events and the block counter as a node would
 * answer them. It mirrors contracts/IdentityRegistry.sol line for line where
 * it matters (checkPresentation's order of checks, subjectDeactivated beside
 * the result); the node suite checks the real contract.
 *
 * `down` makes every read fail like an unreachable endpoint, and
 * `finalizedLag` holds the finalized block that many blocks back.
 */
export class IdentityRegistryFake implements IIdentityChain {
  public down = false
  public reportedChainId: number
  public finalizedLag = 0

  private block = 1
  private readonly heads = new Map<string, IHead>()
  private readonly versions = new Map<string, IVersion[]>()
  private readonly events: (IIdentityChainEvent & { subject: string })[] = []
  /** Head and versions as they stood at each block, for block-tagged reads. */
  private readonly snapshots = new Map<
    number,
    { heads: Map<string, IHead>; versions: Map<string, IVersion[]> }
  >()

  constructor(
    public readonly registry: string,
    chainId: number,
  ) {
    this.reportedChainId = chainId
    this.snapshot()
  }

  public versionCount(subject: string): number {
    return this.heads.get(subject.toLowerCase())?.version ?? 0
  }

  public publish(subject: string, commitment: string, schemaId = 1): number {
    const key = subject.toLowerCase()
    const head = this.heads.get(key) ?? { version: 0, status: 'None' }
    const versions = this.versions.get(key) ?? []
    const version = head.version + 1

    this.block += 1
    versions.push({ commitment, schemaId })
    this.versions.set(key, versions)
    this.heads.set(key, { version, status: 'Active' })
    this.emit(key, {
      kind: EIdentityChainEventKind.PUBLISHED,
      version,
      schemaId,
      commitment,
    })
    this.snapshot()

    return version
  }

  public deactivate(subject: string): void {
    const key = subject.toLowerCase()
    const head = this.heads.get(key)

    if (!head || head.version === 0) {
      throw new Error('NotPublished')
    }

    if (head.status !== 'Active') {
      throw new Error('AlreadyDeactivated')
    }

    this.block += 1
    this.heads.set(key, { version: head.version, status: 'Deactivated' })
    this.emit(key, {
      kind: EIdentityChainEventKind.DEACTIVATED,
      version: head.version,
      schemaId: null,
      commitment: null,
    })
    this.snapshot()
  }

  public async chainId(): Promise<number> {
    this.assertUp()

    return this.reportedChainId
  }

  public async blockNumber(): Promise<number> {
    this.assertUp()

    return this.block
  }

  public async checkPresentation(
    ref: IIdentityPresentationRef,
    blockTag: number | 'finalized',
  ): Promise<IIdentityChainCheck | null> {
    this.assertUp()

    const at =
      blockTag === 'finalized'
        ? Math.max(1, this.block - this.finalizedLag)
        : blockTag
    const state = this.snapshots.get(at)

    if (!state) {
      throw new Error(`No block ${at}`)
    }

    if (ref.registry.toLowerCase() !== this.registry.toLowerCase()) {
      // Another address holds no registry state at all.
      return {
        result: EIdentityChainResult.UNPUBLISHED,
        subjectDeactivated: false,
      }
    }

    const key = ref.subject.toLowerCase()
    const head = state.heads.get(key) ?? { version: 0, status: 'None' }
    const subjectDeactivated = head.status === 'Deactivated'
    const answer = (result: EIdentityChainResult) => ({
      result,
      subjectDeactivated,
    })

    if (head.version === 0) {
      return answer(EIdentityChainResult.UNPUBLISHED)
    }

    if (ref.version === 0 || ref.version > head.version) {
      return answer(EIdentityChainResult.VERSION_UNKNOWN)
    }

    const stored = (state.versions.get(key) ?? [])[ref.version - 1]

    if (stored.commitment !== ref.commitment) {
      return answer(EIdentityChainResult.COMMITMENT_MISMATCH)
    }

    if (stored.schemaId !== ref.schemaId) {
      return answer(EIdentityChainResult.SCHEMA_MISMATCH)
    }

    if (ref.version < head.version) {
      return answer(EIdentityChainResult.SUPERSEDED)
    }

    return answer(
      head.status === 'Active'
        ? EIdentityChainResult.CURRENT
        : EIdentityChainResult.DEACTIVATED,
    )
  }

  public async history(
    ref: IIdentityRegistryRef,
    fromBlock: number,
    toBlock: number,
  ): Promise<IIdentityChainEvent[]> {
    this.assertUp()

    return this.events
      .filter(
        (event) =>
          event.subject === ref.subject.toLowerCase() &&
          event.blockNumber >= fromBlock &&
          event.blockNumber <= toBlock,
      )
      .map(({ subject: _subject, ...event }) => event)
  }

  private emit(
    subject: string,
    event: Pick<
      IIdentityChainEvent,
      'kind' | 'version' | 'schemaId' | 'commitment'
    >,
  ): void {
    this.events.push({
      ...event,
      subject,
      at: new Date(Date.UTC(2026, 8, 19, 12, 0, this.block)).toISOString(),
      blockNumber: this.block,
      transactionHash: `0x${this.block.toString(16).padStart(64, '0')}`,
      logIndex: 0,
    })
  }

  private snapshot(): void {
    this.snapshots.set(this.block, {
      heads: new Map([...this.heads].map(([key, head]) => [key, { ...head }])),
      versions: new Map(
        [...this.versions].map(([key, list]) => [key, [...list]]),
      ),
    })
  }

  private assertUp(): void {
    if (this.down) {
      throw new Error('connect ECONNREFUSED 127.0.0.1:8545')
    }
  }
}
