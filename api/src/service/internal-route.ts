/** One service-to-service route, as its signature names it. */
export interface IInternalRoute {
  method: 'POST'
  /** The full path the caller requests, prefix included. */
  path: string
  /** The header the signature travels in; its own per route. */
  header: string
}

/**
 * Every route the marketplace and billing service call with the shared
 * secret. They all authenticate with one key, so the key alone says nothing
 * about which of them a signature was made for: that comes from these three
 * values, which `EntitlementSignature.signedBytes` puts in front of the body.
 *
 * The values are the wire contract - the contract fixtures under
 * test/fixture carry the same `method`, `path` and `header`, byte for byte
 * with the copies the web repository signs against. A route added here needs
 * its fixture, and its twin in web's `InternalRoute`.
 */
export class InternalRoute {
  public static readonly ENTITLEMENT: IInternalRoute = {
    method: 'POST',
    path: '/api/internal/entitlement',
    header: 'X-Entitlement-Signature',
  }

  public static readonly HIRE: IInternalRoute = {
    method: 'POST',
    path: '/api/internal/marketplace/hire',
    header: 'X-Marketplace-Signature',
  }

  public static readonly END: IInternalRoute = {
    method: 'POST',
    path: '/api/internal/marketplace/end',
    header: 'X-Marketplace-End-Signature',
  }

  public static readonly MILESTONE_INVOICE: IInternalRoute = {
    method: 'POST',
    path: '/api/internal/marketplace/milestone-invoice',
    header: 'X-Marketplace-Milestone-Signature',
  }

  public static readonly AMEND: IInternalRoute = {
    method: 'POST',
    path: '/api/internal/marketplace/amend',
    header: 'X-Marketplace-Amend-Signature',
  }

  public static readonly PAUSE: IInternalRoute = {
    method: 'POST',
    path: '/api/internal/marketplace/pause',
    header: 'X-Marketplace-Pause-Signature',
  }

  public static readonly SETTLEMENT: IInternalRoute = {
    method: 'POST',
    path: '/api/internal/marketplace/settlement',
    header: 'X-Marketplace-Settlement-Signature',
  }

  /**
   * A settlement the app acknowledged that the chain no longer holds: a
   * reorganisation took it back. Its own header, so a captured settlement
   * push can never be sent here to undo the payment it recorded.
   */
  public static readonly SETTLEMENT_REVERSAL: IInternalRoute = {
    method: 'POST',
    path: '/api/internal/marketplace/settlement-reversal',
    header: 'X-Marketplace-Settlement-Reversal-Signature',
  }

  public static readonly ALL: readonly IInternalRoute[] = [
    InternalRoute.ENTITLEMENT,
    InternalRoute.HIRE,
    InternalRoute.END,
    InternalRoute.MILESTONE_INVOICE,
    InternalRoute.AMEND,
    InternalRoute.PAUSE,
    InternalRoute.SETTLEMENT,
    InternalRoute.SETTLEMENT_REVERSAL,
  ]
}
