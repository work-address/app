import { Body, HttpCode, JsonController, Post, Req } from 'routing-controllers'
import express from 'express'

import { App } from '@/app/app'
import {
  EntitlementPushDto,
  SeatInventoryRequestDto,
} from '@/model/dto/entitlement'
import { ISeatInventory } from '@/service/worker-seats'
import { Plan } from '@/service/plan'
import { PlanChange } from '@/service/plan-change'
import { EntitlementSignature } from '@/service/entitlement-signature'
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
  protected plan: Plan
  protected planChange: PlanChange

  constructor() {
    this.entitlementSignature = App.container.get('EntitlementSignature')
    this.userRepository = App.container.get('UserRepository')
    this.plan = App.container.get('Plan')
    this.planChange = App.container.get('PlanChange')
  }

  @HttpCode(200)
  @Post('/entitlement')
  public async push(
    @Body() data: EntitlementPushDto,
    @Req() request: express.Request,
  ): Promise<{ applied: boolean }> {
    await this.authenticate(data, request)

    return runPromise(
      Effect.gen(this, function* () {
        const user = yield* this.userRepository.findOneBy({
          where: { id: data.userId },
        })

        // A push for an account this instance has never seen is not an error
        // the caller can act on - the sweep re-asserts everything
        // periodically, and failing here would make one stale row poison a
        // whole reconciliation run.
        if (!user) {
          return { applied: false }
        }

        yield* this.planChange.apply(user, data.premium)

        return { applied: true }
      }),
    )
  }

  /** Who is on an owner's bill. Billing asks before it charges. */
  @HttpCode(200)
  @Post('/seats')
  public async seats(
    @Body() data: SeatInventoryRequestDto,
    @Req() request: express.Request,
  ): Promise<ISeatInventory> {
    await this.authenticate(data, request)

    const owner = await runPromise(
      this.userRepository.findOneBy({ where: { id: data.userId } }),
    )

    // An owner this instance has never seen has nobody on their bill, which is
    // the one-seat minimum, the same as an owner working alone.
    if (!owner) {
      return { seats: 1, connected: 0, workers: [], ownerEmail: null }
    }

    return this.plan.inventory(
      owner,
      data.from && data.to
        ? { from: new Date(data.from), to: new Date(data.to) }
        : undefined,
    )
  }

  private async authenticate(
    data: { issuedAt: number; nonce: string },
    request: express.Request,
  ): Promise<void> {
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
  }
}
