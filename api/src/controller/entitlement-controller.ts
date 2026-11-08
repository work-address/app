import { Body, HttpCode, JsonController, Post, Req } from 'routing-controllers'
import express from 'express'

import { App } from '@/app/app'
import {
  EntitlementPushDto,
  SeatInventoryRequestDto,
} from '@/model/dto/entitlement'
import { ISeatInventory, WorkerSeats } from '@/service/worker-seats'
import { TimeRepository } from '@/repository/time-repository'
import { EntitlementSignature } from '@/service/entitlement-signature'
import { UserManager } from '@/service/user-manager'
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
  protected userManager: UserManager
  protected userRepository: UserRepository
  protected timeRepository: TimeRepository
  protected workerSeats: WorkerSeats

  constructor() {
    this.entitlementSignature = App.container.get('EntitlementSignature')
    this.userManager = App.container.get('UserManager')
    this.userRepository = App.container.get('UserRepository')
    this.timeRepository = App.container.get('TimeRepository')
    this.workerSeats = App.container.get('WorkerSeats')
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

        // Before the flag, so a failed restore is retried: the sweep re-asserts
        // the same push and this still looks like an upgrade.
        if (data.premium && !user.premium) {
          yield* this.timeRepository.restoreRotated(user.id)
        }

        // Idempotent by construction: the push carries absolute state, so
        // re-applying it costs one write and changes nothing.
        user.premium = data.premium
        yield* this.userManager.saveSingle(user)

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

    return this.workerSeats.inventory(
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
