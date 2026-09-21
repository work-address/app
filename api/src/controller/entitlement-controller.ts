import { Body, HttpCode, JsonController, Post, Req } from 'routing-controllers'
import express from 'express'

import { App } from '@/app/app'
import { EntitlementPushDto } from '@/model/dto/entitlement'
import { IEntitlementPushResult } from '@/model/user'
import { EntitlementSignature } from '@/service/entitlement-signature'
import { InternalRoute } from '@/service/internal-route'
import { UserRepository } from '@/repository/user-repository'
import AuthenticationException from '@/exception/authentication-exception'
import { Effect } from 'effect'
import { runPromise } from '@/service/effect-bridge'

/**
 * Service-to-service entitlement from the billing service.
 *
 * Carries no user token and is deliberately outside `@Authorized` - it is
 * authenticated by HMAC over the raw body instead. Self-hosted instances have
 * no billing service and therefore never receive a call here; absence of the
 * secret makes every request fail closed while Entitlement independently
 * treats the instance as unconditionally premium.
 */
@JsonController('/internal')
export class EntitlementController {
  protected entitlementSignature: EntitlementSignature
  protected userRepository: UserRepository

  constructor() {
    this.entitlementSignature = App.container.get('EntitlementSignature')
    this.userRepository = App.container.get('UserRepository')
  }

  @HttpCode(200)
  @Post('/entitlement')
  public async push(
    @Body() data: EntitlementPushDto,
    @Req() request: express.Request,
  ): Promise<IEntitlementPushResult> {
    const signature = request.header(InternalRoute.ENTITLEMENT.header) ?? ''
    const raw = JSON.stringify(data)

    if (
      !this.entitlementSignature.verify(
        InternalRoute.ENTITLEMENT,
        raw,
        signature,
      )
    ) {
      throw new AuthenticationException('Invalid entitlement signature')
    }

    if (!this.entitlementSignature.isWithinReplayWindow(data.issuedAt)) {
      throw new AuthenticationException(
        'Entitlement push outside the replay window',
      )
    }

    if (!(await this.entitlementSignature.consumeNonce(data.nonce))) {
      throw new AuthenticationException('Entitlement push nonce already used')
    }

    return runPromise(
      Effect.gen(this, function* () {
        const { outcome, heldRevision } =
          yield* this.userRepository.applyEntitlement(
            data.userId,
            data.premium,
            data.revision,
            data.validUntil ? new Date(data.validUntil) : null,
          )

        if (outcome === 'applied') {
          return { applied: true }
        }

        // Still a 200, not an error: failing here would make one row the
        // billing service cannot fix poison a whole reconciliation run.
        // But `applied: false` is not a delivery, and the billing service
        // must not book it as one - so it is told why.
        //
        // 'unknown': this instance has never seen the account, which means
        // the two services are pointed at different deployments.
        // 'stale': the account already holds a newer revision. Usually the
        // push was overtaken in flight, and applying it would re-grant after
        // a revoke, or revoke a paying customer because an old `false`
        // arrived late. When it is not - the billing service's counter has
        // fallen behind this one - every push is ignored until it catches
        // up, so the revision held here goes back with the answer.
        return outcome === 'stale' && heldRevision !== null
          ? { applied: false, reason: outcome, heldRevision }
          : { applied: false, reason: outcome }
      }),
    )
  }
}
