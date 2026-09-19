import { Contract, Interface, JsonRpcProvider, Network } from 'ethers'

import {
  EIdentityChainEventKind,
  EIdentityChainResult,
  IIdentityChain,
  IIdentityChainCheck,
  IIdentityChainEvent,
  IIdentityPresentationRef,
  IIdentityRegistryRef,
} from '@/model/identity'

/**
 * `IdentityRegistry.Presentation` by its uint8 value: the contract's
 * declaration order, which is part of its ABI.
 */
const RESULTS: readonly EIdentityChainResult[] = [
  EIdentityChainResult.UNPUBLISHED,
  EIdentityChainResult.VERSION_UNKNOWN,
  EIdentityChainResult.COMMITMENT_MISMATCH,
  EIdentityChainResult.SCHEMA_MISMATCH,
  EIdentityChainResult.SUPERSEDED,
  EIdentityChainResult.DEACTIVATED,
  EIdentityChainResult.CURRENT,
]

const REGISTRY = new Interface([
  'function checkPresentation(address subject, uint32 version, bytes32 commitment, uint32 schemaId) view returns (uint8 result, bool subjectDeactivated)',
  'event IdentityPublished(address indexed subject, uint32 indexed version, uint32 schemaId, bytes32 commitment, uint64 publishedAt)',
  'event IdentityDeactivated(address indexed subject, uint32 indexed version, uint64 deactivatedAt)',
])

/**
 * IdentityRegistry over JSON-RPC, read-only: there is no signer here, so
 * nothing this service does can publish, withdraw or pay for anything. The
 * holder's own wallet sends every transaction.
 *
 * The network is pinned to the configured chain id, so ethers never polls to
 * detect it; IdentityManager asks eth_chainId itself and refuses a node that
 * answers as another chain. Request caching is off, so a check made right
 * after a holder's publish sees the new block.
 */
export class IdentityRpcChain implements IIdentityChain {
  private readonly provider: JsonRpcProvider

  constructor(rpcUrl: string, chainId: number) {
    const network = Network.from(chainId)

    this.provider = new JsonRpcProvider(rpcUrl, network, {
      staticNetwork: network,
      batchMaxCount: 1,
      cacheTimeout: -1,
    })
  }

  public async chainId(): Promise<number> {
    return Number(BigInt(await this.provider.send('eth_chainId', [])))
  }

  public blockNumber(): Promise<number> {
    return this.provider.getBlockNumber()
  }

  public async checkPresentation(
    ref: IIdentityPresentationRef,
    blockTag: number | 'finalized',
  ): Promise<IIdentityChainCheck | null> {
    if (blockTag === 'finalized' && !(await this.hasFinalizedBlock())) {
      return null
    }

    const registry = new Contract(ref.registry, REGISTRY, this.provider)
    const [result, subjectDeactivated] = (await registry.checkPresentation(
      ref.subject,
      ref.version,
      ref.commitment,
      ref.schemaId,
      { blockTag },
    )) as [bigint, boolean]
    const named = RESULTS[Number(result)]

    if (named === undefined) {
      throw new RangeError(`checkPresentation answered ${result}, not a result`)
    }

    return { result: named, subjectDeactivated }
  }

  public async history(
    ref: IIdentityRegistryRef,
    fromBlock: number,
    toBlock: number,
  ): Promise<IIdentityChainEvent[]> {
    const published = REGISTRY.getEvent('IdentityPublished')
    const deactivated = REGISTRY.getEvent('IdentityDeactivated')

    if (!published || !deactivated) {
      throw new Error('The registry ABI lost its events')
    }

    const [subjectTopic] = REGISTRY.encodeFilterTopics(published, [
      ref.subject,
    ]).slice(1)
    const logs = await this.provider.getLogs({
      address: ref.registry,
      fromBlock,
      toBlock,
      topics: [[published.topicHash, deactivated.topicHash], subjectTopic],
    })

    return logs
      .filter((log) => !log.removed)
      .map((log): IIdentityChainEvent => {
        const parsed = REGISTRY.parseLog(log)

        if (!parsed) {
          throw new Error(`Unreadable registry log in ${log.transactionHash}`)
        }

        const isPublished = parsed.name === 'IdentityPublished'
        const at = Number(
          isPublished ? parsed.args.publishedAt : parsed.args.deactivatedAt,
        )

        return {
          kind: isPublished
            ? EIdentityChainEventKind.PUBLISHED
            : EIdentityChainEventKind.DEACTIVATED,
          version: Number(parsed.args.version),
          schemaId: isPublished ? Number(parsed.args.schemaId) : null,
          commitment: isPublished ? String(parsed.args.commitment) : null,
          at: new Date(at * 1000).toISOString(),
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          logIndex: log.index,
        }
      })
      .sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex)
  }

  /** A node without a finalized tag says so as an error; that is "no". */
  private async hasFinalizedBlock(): Promise<boolean> {
    try {
      return (await this.provider.getBlock('finalized')) !== null
    } catch {
      return false
    }
  }
}
