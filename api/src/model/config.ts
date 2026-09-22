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
  /**
   * Whether an internal call signed the old way - the bare hex HMAC of the
   * body, with no route in it - is still accepted. On for the one release in
   * which the marketplace learns to sign `v2`, so the two services can be
   * deployed in either order; off, only a route-bound signature is accepted.
   */
  internalSignatureAcceptLegacy: boolean
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
    /**
     * The registry's deployment block: where the version history's event
     * scan starts. 0 when unset, which a local node answers but a public
     * RPC's log-range limit may not.
     */
    deployBlock: number
  }
  /**
   * The relay for holders whose wallet has no gas (WP-122): a hot key that
   * sends IdentityRegistry.publishFor and deactivateFor with the subject's
   * own signed authorization, and pays their gas - nothing else. It is off
   * until an operator both decides to run it and funds its key, so an empty
   * key turns it off: GET /identity/config then reports `relayEnabled:
   * false` and POST /user/identity/relay answers 503. The holder's direct
   * transaction is always available either way.
   */
  identityRelayer: {
    /** The relayer's private key. Empty, or not a key, turns the relay off. */
    key: string
    /** The most gas one relayed transaction may use; a costlier one is not sent. */
    gasLimit: number
    /** The most the relayer pays per gas, in gwei; above it nothing is sent. */
    maxFeeGwei: number
    /**
     * Relayed publications one account may ask for per day. Withdrawals are
     * never counted: a takedown must not be losable to a ration.
     */
    publishesPerDay: number
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
