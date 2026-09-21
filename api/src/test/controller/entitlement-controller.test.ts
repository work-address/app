import { randomUUID } from 'crypto'
import axios from 'axios'
import { expect } from 'chai'
import { suite, test } from '@testdeck/mocha'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { EntitlementSignature } from '@/service/entitlement-signature'
import { Entitlement } from '@/service/entitlement'
import { UserRepository } from '@/repository/user-repository'
import { runPromise } from '@/service/effect-bridge'
import { User } from '@/entity/user'

const HOUR_MS = 60 * 60 * 1000

/**
 * POST /api/internal/entitlement, the receiving end of the billing push.
 *
 * Signed with the instance's entitlement secret, the way billing signs it:
 * over the exact bytes sent, in the contract's key order.
 */
@suite
export class EntitlementControllerTest extends BaseControllerTest {
  protected signature: EntitlementSignature
  protected entitlement: Entitlement
  protected userRepository: UserRepository

  constructor() {
    super()

    this.signature = this.container.get('EntitlementSignature')
    this.entitlement = this.container.get('Entitlement')
    this.userRepository = this.container.get('UserRepository')
  }

  protected body(
    userId: string,
    overrides: Partial<{
      premium: boolean
      revision: number
      validUntil: string | null
      issuedAt: number
      nonce: string
    }> = {},
  ) {
    return {
      userId,
      premium: overrides.premium ?? true,
      revision: overrides.revision ?? 1,
      validUntil:
        overrides.validUntil === undefined
          ? new Date(Date.now() + 30 * 24 * HOUR_MS).toISOString()
          : overrides.validUntil,
      issuedAt: overrides.issuedAt ?? Math.floor(Date.now() / 1000),
      nonce: overrides.nonce ?? randomUUID(),
    }
  }

  protected post(body: Record<string, unknown>, signature?: string) {
    const raw = JSON.stringify(body)

    return axios.post(`${this.url}/api/internal/entitlement`, raw, {
      headers: {
        'Content-Type': 'application/json',
        'X-Entitlement-Signature': signature ?? this.signature.sign(raw),
      },
      validateStatus: () => true,
    })
  }

  protected reload(user: User): Promise<User> {
    return runPromise(
      this.userRepository.findOneByOrFail({ where: { id: user.id } }),
    )
  }

  /**
   * The acceptance case for ordering: a revoke at revision 5 followed by a
   * grant at revision 4 that was overtaken in flight leaves the account
   * revoked.
   */
  @test
  async push_anOlderRevisionAfterANewerOneIsIgnored() {
    const user = await this.userFixture.createUser()

    const revoke = await this.post(
      this.body(user.id, { premium: false, revision: 5 }),
    )
    const late = await this.post(
      this.body(user.id, { premium: true, revision: 4 }),
    )

    expect(revoke.status).to.be.eq(200)
    expect(revoke.data.applied).to.be.true
    expect(late.status).to.be.eq(200)
    expect(late.data.applied, 'overtaken, so not applied').to.be.false

    const stored = await this.reload(user)
    expect(stored.premium).to.be.false
    expect(stored.entitlementRevision).to.be.eq(5)
  }

  /** The sweep re-asserts the current revision, and that must still apply. */
  @test
  async push_theSameRevisionAgainIsApplied() {
    const user = await this.userFixture.createUser()

    await this.post(this.body(user.id, { premium: true, revision: 3 }))
    const again = await this.post(
      this.body(user.id, { premium: true, revision: 3 }),
    )

    expect(again.data.applied).to.be.true
    expect((await this.reload(user)).premium).to.be.true
  }

  /**
   * Two pushes for one account at once: the conditional UPDATE orders them,
   * so the newer revision wins however they interleave.
   */
  @test
  async push_concurrentPushesKeepTheNewestRevision() {
    const user = await this.userFixture.createUser()

    await Promise.all([
      this.post(this.body(user.id, { premium: false, revision: 9 })),
      this.post(this.body(user.id, { premium: true, revision: 8 })),
      this.post(this.body(user.id, { premium: true, revision: 7 })),
    ])

    const stored = await this.reload(user)
    expect(stored.entitlementRevision).to.be.eq(9)
    expect(stored.premium).to.be.false
  }

  /**
   * The validity travels with the push and is enforced here: past it the
   * account is not premium, even though no revoke ever arrived.
   */
  @test
  async push_premiumLapsesAfterThePushedValidity() {
    const user = await this.userFixture.createUser()
    const now = new Date()

    await this.post(
      this.body(user.id, {
        premium: true,
        revision: 1,
        validUntil: new Date(now.getTime() + HOUR_MS).toISOString(),
      }),
    )
    const stored = await this.reload(user)

    expect(stored.premiumValidUntil!.getTime()).to.be.eq(
      now.getTime() + HOUR_MS,
    )
    expect(this.entitlement.isPremium(stored, now)).to.be.true
    expect(
      this.entitlement.isPremium(stored, new Date(now.getTime() + 2 * HOUR_MS)),
    ).to.be.false
  }

  /**
   * An ordinary save of a User loaded before the push cannot write an older
   * revision back: the column is written only by the conditional UPDATE.
   */
  @test
  async push_aStaleSaveOfTheUserCannotLowerTheRevision() {
    const user = await this.userFixture.createUser()
    const stale = await this.reload(user)

    await this.post(this.body(user.id, { premium: true, revision: 6 }))

    stale.city = 'Lisbon'
    await runPromise(this.userRepository.saveSingle(stale))

    expect((await this.reload(user)).entitlementRevision).to.be.eq(6)
  }
}
