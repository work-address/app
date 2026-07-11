export interface IConfigParameters {
  host: string
  port: number
  sentry: string
  redis: string
  jwtSecret: string
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
