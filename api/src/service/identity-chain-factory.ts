import { injectable } from 'inversify'

import { IIdentityChain } from '@/model/identity'
import { IdentityRpcChain } from '@/service/identity-rpc-chain'

/**
 * One read-only chain client per RPC endpoint and chain id, kept for the
 * life of the process: a provider is cheap to keep and costly to recreate
 * on every profile read. Bound as a singleton, so every IdentityManager
 * shares it.
 */
@injectable()
export class IdentityChainFactory {
  private readonly chains = new Map<string, IIdentityChain>()

  public create(rpcUrl: string, chainId: number): IIdentityChain {
    const key = `${chainId} ${rpcUrl}`
    const known = this.chains.get(key)

    if (known) {
      return known
    }

    const chain = new IdentityRpcChain(rpcUrl, chainId)

    this.chains.set(key, chain)

    return chain
  }
}
