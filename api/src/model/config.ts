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
  /** Empty hides Google sign-in, as on a network that can't reach Google. */
  googleClientId: string
  database: {
    type: string
    host: string
    port: number
    username: string
    password: string
    database: string
  }
}
