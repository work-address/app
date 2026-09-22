import { injectable, inject } from 'inversify'
import * as crypto from 'crypto'

import { IConfigParameters } from '@/model/config'
import { IInternalRoute } from '@/service/internal-route'
import { RedisClient } from '@/service/redis-client'

/**
 * Authenticates the entitlement push from the billing service.
 *
 * Deliberately not the JWT secret, even though both deployments already hold
 * it: a leaked entitlement secret must not also be able to forge user
 * sessions. Two secrets, two blast radii.
 */
@injectable()
export class EntitlementSignature {
  @inject('parameters')
  protected parameters: IConfigParameters
  @inject('RedisClient')
  protected redisClient: RedisClient

  /** Seconds either side of `issuedAt` that a push is accepted. */
  public static replayWindowSeconds: number = 300

  /**
   * The signature version this service speaks. It leads both the signed
   * bytes and the header value (`v2=<hex>`), so a later change of format is
   * a new version rather than a second guess at the same header.
   */
  public static readonly VERSION: string = 'v2'

  /**
   * The bytes a route's signature covers: the version, the method, the path,
   * the header it travels in, then the body, one per line.
   *
   * Every internal call is signed with the same key. Over the body alone, a
   * captured hire was refused as an end only because the two DTOs happen to
   * differ; with the route in the signed bytes, a signature made for one
   * route is not a signature for any other, whatever the bodies look like.
   * The header is lowercased because HTTP header names are
   * case-insensitive and the two services must derive the same bytes.
   */
  public static signedBytes(route: IInternalRoute, body: string): string {
    return [
      EntitlementSignature.VERSION,
      route.method,
      route.path,
      route.header.toLowerCase(),
      body,
    ].join('\n')
  }

  /** The header value for `body` sent to `route`: `v2=<hex>`. */
  public sign(route: IInternalRoute, body: string): string {
    const digest = this.hmac(EntitlementSignature.signedBytes(route, body))

    return `${EntitlementSignature.VERSION}=${digest}`
  }

  /**
   * The form every caller sent before signatures named their route: the bare
   * hex HMAC of the body. Still produced so the suite can prove when it is
   * accepted and when it is not; nothing in the service sends it.
   */
  public signLegacy(body: string): string {
    return this.hmac(body)
  }

  /**
   * Whether `signature` authorises `body` on `route`.
   *
   * A value that names a version is held to that version: `v2=` is checked
   * against the route-bound bytes and nothing else, so a caller that has
   * moved on can never be downgraded by stripping the prefix - the bare hex
   * of a v2 digest is not the legacy HMAC of anything.
   *
   * A bare hex value is the legacy form. It is accepted only while
   * `internalSignatureAcceptLegacy` is on, which is the one-release window
   * that lets a marketplace deployed minutes before or after this service
   * keep working; see docs/internal-signature.md for the rollout.
   */
  public verify(
    route: IInternalRoute,
    body: string,
    signature: string,
  ): boolean {
    if (!this.parameters.entitlementSecret) {
      return false
    }

    if (signature?.includes('=')) {
      return this.matches(this.sign(route, body), signature)
    }

    if (!this.parameters.internalSignatureAcceptLegacy) {
      return false
    }

    return this.matches(this.signLegacy(body), signature)
  }

  public isWithinReplayWindow(
    issuedAt: number,
    now: number = Date.now(),
  ): boolean {
    const skew = Math.abs(Math.floor(now / 1000) - issuedAt)

    return skew <= EntitlementSignature.replayWindowSeconds
  }

  /**
   * True the first time a nonce is seen. Held for the width of the replay
   * window - beyond it the timestamp check refuses the request anyway, so
   * keeping nonces longer buys nothing and grows unboundedly.
   *
   * Without this a captured request grants premium forever: the signature
   * stays valid, and only the timestamp limits how long it can be replayed.
   */
  public async consumeNonce(nonce: string): Promise<boolean> {
    const key = `entitlement:nonce:${nonce}`

    if (await this.redisClient.get(key)) {
      return false
    }

    // setWithExpiry takes milliseconds.
    await this.redisClient.setWithExpiry(
      key,
      '1',
      EntitlementSignature.replayWindowSeconds * 1000,
    )

    return true
  }

  private hmac(bytes: string): string {
    return crypto
      .createHmac('sha256', this.parameters.entitlementSecret)
      .update(bytes)
      .digest('hex')
  }

  /**
   * Constant-time compare. A plain `===` on a hex digest leaks a byte at a
   * time under timing analysis, which is enough to forge a signature offline.
   */
  private matches(expected: string, given: string | undefined): boolean {
    const want = Buffer.from(expected, 'utf8')
    const got = Buffer.from(given ?? '', 'utf8')

    if (want.length !== got.length) {
      return false
    }

    return crypto.timingSafeEqual(want, got)
  }
}
