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
  database: {
    type: string
    host: string
    port: number
    username: string
    password: string
    database: string
  }
}
