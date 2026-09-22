import { injectable } from 'inversify'

import { IIdentityRelayerChain } from '@/model/identity'
import { IdentityRelayerRpcChain } from '@/service/identity-relayer-rpc-chain'

/**
 * One relayer chain client per endpoint, chain, registry and key, kept for
 * the life of the process as the read-only IdentityChainFactory keeps its
 * own. Bound as a singleton; the tests swap `create` for a fake.
 */
@injectable()
export class IdentityRelayerChainFactory {
  private readonly chains = new Map<string, IIdentityRelayerChain>()

  public create(
    rpcUrl: string,
    chainId: number,
    registryAddress: string,
    relayerKey: string,
  ): IIdentityRelayerChain {
    const key = `${chainId} ${rpcUrl} ${registryAddress.toLowerCase()} ${relayerKey}`
    const known = this.chains.get(key)

    if (known) {
      return known
    }

    const chain = new IdentityRelayerRpcChain(
      rpcUrl,
      chainId,
      registryAddress,
      relayerKey,
    )

    this.chains.set(key, chain)

    return chain
  }
}
