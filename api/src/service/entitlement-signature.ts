import { injectable, inject } from 'inversify'
import * as crypto from 'crypto'

import { IConfigParameters } from '@/model/config'
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

  public sign(body: string): string {
    return crypto
      .createHmac('sha256', this.parameters.entitlementSecret)
      .update(body)
      .digest('hex')
  }

  /**
   * Constant-time compare. A plain `===` on a hex digest leaks a byte at a
   * time under timing analysis, which is enough to forge a signature offline.
   */
  public verify(body: string, signature: string): boolean {
    if (!this.parameters.entitlementSecret) {
      return false
    }

    const expected = Buffer.from(this.sign(body), 'utf8')
    const actual = Buffer.from(signature ?? '', 'utf8')

    if (expected.length !== actual.length) {
      return false
    }

    return crypto.timingSafeEqual(expected, actual)
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
}
