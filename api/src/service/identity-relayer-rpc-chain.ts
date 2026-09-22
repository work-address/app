import {
  Contract,
  Interface,
  isError,
  JsonRpcProvider,
  Network,
  Wallet,
} from 'ethers'

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

/**
 * The two relayed entry points of IdentityRegistry, the one view the relay
 * reads, and every custom error the registry can revert with, so a dry run
 * that fails is told apart by name.
 */
const RELAYER_ABI = [
  'function publishFor(address subject, bytes32 commitment, uint32 schemaId, uint32 expectedVersion, uint64 deadline, bytes subjectSignature)',
  'function deactivateFor(address subject, uint32 expectedVersion, uint64 deadline, bytes subjectSignature)',
  'function nonces(address subject) view returns (uint256)',
  'error InvalidCommitment()',
  'error InvalidSchema()',
  'error VersionConflict(uint32 expected, uint32 current)',
  'error NotPublished()',
  'error AlreadyDeactivated()',
  'error UnknownVersion(uint32 requested, uint32 current)',
  'error VersionOverflow()',
  'error AuthorizationExpired()',
  'error InvalidAuthorization()',
] as const

/**
 * IdentityRegistry over JSON-RPC with the relayer's own key. The network is
 * pinned to the configured chain id and nothing is served from a response
 * cache, so the nonce and state read right before a send are the chain's
 * then. The key signs only the two relayed calls built from what the
 * subject signed; there is no other method here that sends.
 */
export class IdentityRelayerRpcChain implements IIdentityRelayerChain {
  public readonly address: string

  private readonly provider: JsonRpcProvider
  private readonly wallet: Wallet
  private readonly registry: Contract
  private readonly errors = new Interface([...RELAYER_ABI])

  constructor(
    rpcUrl: string,
    chainId: number,
    registryAddress: string,
    relayerKey: string,
  ) {
    const network = Network.from(chainId)

    this.provider = new JsonRpcProvider(rpcUrl, network, {
      staticNetwork: network,
      batchMaxCount: 1,
      cacheTimeout: -1,
    })
    this.wallet = new Wallet(relayerKey, this.provider)
    this.address = this.wallet.address
    this.registry = new Contract(registryAddress, [...RELAYER_ABI], this.wallet)
  }

  public async chainId(): Promise<number> {
    return Number(BigInt(await this.provider.send('eth_chainId', [])))
  }

  public async latestTimestamp(): Promise<number> {
    const block = await this.provider.getBlock('latest')

    if (!block) {
      throw new Error('The identity RPC returned no latest block')
    }

    return block.timestamp
  }

  public async subjectNonce(subject: string): Promise<bigint> {
    return (await this.registry.nonces(subject, {
      blockTag: 'latest',
    })) as bigint
  }

  /**
   * eth_estimateGas from the relayer's address: the call as it would run
   * now. A revert comes back as the registry's error name, never thrown; a
   * failure to reach the node is thrown.
   */
  public async simulate(
    call: IIdentityRelayCall,
  ): Promise<TIdentityRelaySimulation> {
    try {
      const [method, args] = this.callOf(call)

      return {
        gas: await this.registry.getFunction(method).estimateGas(...args),
      }
    } catch (error: unknown) {
      if (!isError(error, 'CALL_EXCEPTION')) {
        throw error
      }

      return { revert: this.revertName(error.data) }
    }
  }

  public async fees(): Promise<IIdentityRelayFees> {
    const [block, data] = await Promise.all([
      this.provider.getBlock('latest'),
      this.provider.getFeeData(),
    ])
    const baseFeePerGas = block?.baseFeePerGas ?? data.gasPrice ?? BigInt(0)

    return {
      baseFeePerGas,
      maxFeePerGas: data.maxFeePerGas ?? data.gasPrice ?? baseFeePerGas,
      maxPriorityFeePerGas: data.maxPriorityFeePerGas ?? BigInt(0),
    }
  }

  public balance(): Promise<bigint> {
    return this.provider.getBalance(this.address, 'latest')
  }

  public pendingNonce(): Promise<number> {
    return this.provider.getTransactionCount(this.address, 'pending')
  }

  public async transactionState(
    txHash: string,
  ): Promise<TIdentityRelayTxState> {
    const receipt = await this.provider.getTransactionReceipt(txHash)

    if (receipt) {
      return receipt.status === 1 ? 'mined' : 'reverted'
    }

    return (await this.provider.getTransaction(txHash)) === null
      ? 'unknown'
      : 'pending'
  }

  public async send(
    call: IIdentityRelayCall,
    gas: IIdentityRelayGas,
  ): Promise<string> {
    const [method, args] = this.callOf(call)
    const tx = await this.registry.getFunction(method)(...args, {
      nonce: gas.nonce,
      gasLimit: gas.gasLimit,
      maxFeePerGas: gas.maxFeePerGas,
      maxPriorityFeePerGas: gas.maxPriorityFeePerGas,
    })

    return (tx as { hash: string }).hash
  }

  /**
   * One confirmation, or null when none came within `waitMs`: a
   * transaction still waiting may yet be mined, so it is not a failure.
   */
  public async outcome(
    txHash: string,
    waitMs: number,
  ): Promise<TIdentityRelayOutcome> {
    try {
      const receipt = await this.provider.waitForTransaction(txHash, 1, waitMs)

      if (!receipt) {
        return null
      }

      return receipt.status === 1 ? 'mined' : 'reverted'
    } catch (error: unknown) {
      if (isError(error, 'TIMEOUT')) {
        return null
      }

      throw error
    }
  }

  /** The registry method and its arguments, taken from the signed call alone. */
  private callOf(call: IIdentityRelayCall): [string, unknown[]] {
    if (call.operation === EIdentityRelayOperation.PUBLISH) {
      return [
        'publishFor',
        [
          call.subject,
          call.commitment,
          call.schemaId,
          call.expectedVersion,
          call.deadline,
          call.signature,
        ],
      ]
    }

    return [
      'deactivateFor',
      [call.subject, call.expectedVersion, call.deadline, call.signature],
    ]
  }

  private revertName(data: unknown): string | null {
    if (typeof data !== 'string' || !data.startsWith('0x')) {
      return null
    }

    try {
      return this.errors.parseError(data)?.name ?? null
    } catch {
      return null
    }
  }
}
