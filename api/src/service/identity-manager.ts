import { inject, injectable } from 'inversify'
import * as web3 from 'web3'

import { IConfigParameters } from '@/model/config'
import { IIdentityConfig } from '@/model/identity'

const EVM_ADDRESS = /^0x[\dA-Fa-f]{40}$/

/**
 * Portable identity for the User domain: where this instance anchors profile
 * commitments (IdentityRegistry), read from APP_IDENTITY_*.
 */
@injectable()
export class IdentityManager {
  /** Profile schema v1 is the only one this service understands. */
  public static readonly SCHEMA_IDS = [1]

  @inject('parameters')
  protected parameters: IConfigParameters

  /**
   * Read on every call rather than cached, so the answer is always the
   * configuration the next chain read would use.
   */
  public getConfig(): IIdentityConfig {
    const enabled = this.isEnabled()
    const { chainId, registryAddress, manifestUrl } = this.parameters.identity

    return {
      enabled,
      chainId: enabled ? chainId : null,
      registryAddress: enabled
        ? web3.utils.toChecksumAddress(registryAddress)
        : null,
      manifestUrl: enabled && manifestUrl ? manifestUrl : null,
      schemaIds: [...IdentityManager.SCHEMA_IDS],
    }
  }

  /**
   * All three of chain, registry and RPC endpoint, or nothing: a registry
   * without a chain id could be read on the wrong network, and one without an
   * endpoint cannot be read at all.
   */
  public isEnabled(): boolean {
    const { chainId, registryAddress, rpcUrl } = this.parameters.identity

    return (
      chainId !== null && EVM_ADDRESS.test(registryAddress) && rpcUrl !== ''
    )
  }
}
