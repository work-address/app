export interface IConfigParameters {
  host: string
  port: number
  sentry: string
  redis: string
  jwtSecret: string
  /**
   * Shared secret for the entitlement push from the billing service. Empty
   * means this instance is self-hosted: no billing service exists to grant
   * premium, so every account is entitled. See Entitlement.
   */
  entitlementSecret: string
  /** Loggly credentials as `subdomain/customer-token`. Empty disables Loggly. */
  loggly: string
  tonAllowedDomains: string[]
  /**
   * Where profile commitments are anchored: an IdentityRegistry deployment and
   * a JSON-RPC endpoint to read it. Anchoring is enabled only when the chain
   * id, the registry and the RPC URL are all set; otherwise GET
   * /identity/config reports `enabled: false` and nothing reads a chain.
   */
  identity: {
    /** EIP-155 chain id of the registry; null when unset. */
    chainId: number | null
    registryAddress: string
    /** Read-only (eth_call, eth_getLogs); never exposed by any endpoint. */
    rpcUrl: string
    /** Where the signed release manifest naming this registry is published. */
    manifestUrl: string
  }
  database: {
    type: string
    host: string
    port: number
    username: string
    password: string
    database: string
  }
}
