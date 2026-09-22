import type { IdentityWalletFailure } from './identity-state'
import type { baseApi } from '@/shared'

/** What the holder's wallet sends. Reads use the same two view functions. */
export const IDENTITY_REGISTRY_ABI = [
  'function publish(bytes32 commitment, uint32 schemaId, uint32 expectedVersion)',
  'function deactivate(uint32 expectedVersion)',
  'function versionCount(address subject) view returns (uint32)',
  'function nonces(address subject) view returns (uint256)',
] as const

export type IdentityConfig = baseApi.IdentityControllerConfigResponse

/** Where the holder's wallet sends, once every part of it is known. */
export type IdentityChainTarget = {
  chainId: number
  registryAddress: string
  rpcUrl: string
}

export class IdentityWalletError extends Error {
  readonly code: IdentityWalletFailure

  constructor(code: IdentityWalletFailure, message?: string) {
    super(message ?? `identity wallet: ${code}`)
    this.name = 'IdentityWalletError'
    this.code = code
  }
}

/**
 * The endpoint this browser sends the holder's transactions through.
 *
 * `GET /identity/config` deliberately never carries an RPC URL - it can hold
 * a provider key, and, as profile schema v1 puts it, whoever reads the chain
 * should read it through an endpoint they trust themselves. So the browser
 * brings its own, and says plainly when it has none rather than borrowing the
 * API's.
 */
export const identityRpcUrl = (): string =>
  (import.meta.env.VITE_IDENTITY_RPC_URL ?? '').trim()

/**
 * The target, or null when something is missing: anchoring off here, a
 * registry with no chain id, or no endpoint in this browser. Null is not a
 * failure yet - it is why the card offers no publish button.
 */
export const identityChainTarget = (
  config: IdentityConfig | null,
  rpcUrl: string = identityRpcUrl(),
): IdentityChainTarget | null => {
  if (
    !config?.enabled ||
    config.chainId === null ||
    !config.registryAddress ||
    rpcUrl === ''
  ) {
    return null
  }

  return {
    chainId: config.chainId,
    registryAddress: config.registryAddress,
    rpcUrl,
  }
}

/**
 * ethers' own error codes, and the wallet states above them, as one failure
 * the card can show. Anything unrecognised is `failed`: a holder is told the
 * transaction did not go through, never that their profile was refused.
 */
export const identityWalletFailure = (
  error: unknown,
): IdentityWalletFailure => {
  if (error instanceof IdentityWalletError) {
    return error.code
  }

  const code = (error as { code?: unknown } | null)?.code

  if (code === 'ACTION_REJECTED') {
    return 'declined'
  }

  if (code === 'NETWORK_ERROR' || code === 'SERVER_ERROR') {
    return 'noEndpoint'
  }

  return 'failed'
}
