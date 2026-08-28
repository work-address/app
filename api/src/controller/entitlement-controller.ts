import { Body, HttpCode, JsonController, Post, Req } from 'routing-controllers'
import express from 'express'

import { App } from '@/app/app'
import { EntitlementPushDto } from '@/model/dto/entitlement'
import { EntitlementSignature } from '@/service/entitlement-signature'
import { UserManager } from '@/service/user-manager'
import { UserRepository } from '@/repository/user-repository'
import AuthenticationException from '@/exception/authentication-exception'
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
  protected userManager: UserManager
  protected userRepository: UserRepository

  constructor() {
    this.entitlementSignature = App.container.get('EntitlementSignature')
    this.userManager = App.container.get('UserManager')
    this.userRepository = App.container.get('UserRepository')
  }

  @HttpCode(200)
  @Post('/entitlement')
  public async push(
    @Body() data: EntitlementPushDto,
    @Req() request: express.Request,
  ): Promise<{ applied: boolean }> {
    const signature = request.header('X-Entitlement-Signature') ?? ''
    const raw = JSON.stringify(data)

    if (!this.entitlementSignature.verify(raw, signature)) {
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

    const user = await runPromise(
      this.userRepository.findOneBy({
        where: { id: data.userId },
      }),
    )

    // A push for an account this instance has never seen is not an error the
    // caller can act on - the sweep re-asserts everything periodically, and
    // failing here would make one stale row poison a whole reconciliation run.
    if (!user) {
      return { applied: false }
    }

    // Idempotent by construction: the push carries absolute state, so
    // re-applying it costs one write and changes nothing.
    user.premium = data.premium
    await runPromise(this.userManager.saveSingle(user))

    return { applied: true }
  }
}
