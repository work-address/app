/**
 * Where this instance anchors profile commitments, as GET /identity/config
 * answers anyone. Everything but `enabled` and `schemaIds` is null when
 * anchoring is not configured. The RPC URL is never part of it: it can carry
 * a provider key, and a verifier should use an endpoint it trusts itself.
 */
export interface IIdentityConfig {
  enabled: boolean
  chainId: number | null
  /** EIP-55, as a presentation's anchor must spell it. */
  registryAddress: string | null
  manifestUrl: string | null
  /** Profile schemas this service can check. */
  schemaIds: number[]
}
