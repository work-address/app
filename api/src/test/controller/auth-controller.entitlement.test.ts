import { expect } from 'chai'
import { suite, test } from '@testdeck/mocha'

import { authControllerStatus } from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { User } from '@/entity/user'

/**
 * SUB-09: the holder's own payload says what this instance decides about
 * premium, and whether hosted billing applies here at all.
 *
 * app/web used to read the raw premium column, which nothing ever sets on a
 * self-hosted instance, so every self-hosted user was shown 'No premium' and
 * an Upgrade link to a hosted plan that does not apply to them.
 */
@suite()
export class AuthControllerEntitlementTest extends BaseControllerTest {
  private savedSecret: string | undefined

  async after() {
    if (this.savedSecret !== undefined) {
      this.parameters.entitlementSecret = this.savedSecret
    }

    await super.after()
  }

  /** Runs the rest of the test as a self-hosted instance: no billing secret. */
  private selfHosted(): void {
    this.savedSecret = this.parameters.entitlementSecret
    this.parameters.entitlementSecret = ''
  }

  private async status(user: User) {
    const res = await authControllerStatus({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      throwOnError: true,
    })

    return res.data as unknown as { premium?: boolean; billing?: boolean }
  }

  @test()
  async saas_aFreeAccountIsFreeAndBilled() {
    const user = await this.userFixture.createUser()

    const status = await this.status(user)

    expect(status.premium).to.be.false
    expect(status.billing).to.be.true
  }

  @test()
  async saas_aPremiumAccountIsPremiumAndBilled() {
    const user = await this.userFixture.createPremiumUser()

    const status = await this.status(user)

    expect(status.premium).to.be.true
    expect(status.billing).to.be.true
  }

  /**
   * Self-host is unrestricted and has no plan to sell, whatever the column
   * says: premium, and no billing.
   */
  @test()
  async selfHosted_everyAccountIsPremiumWithNoBilling() {
    const user = await this.userFixture.createUser()
    this.selfHosted()

    const status = await this.status(user)

    expect(status.premium).to.be.true
    expect(status.billing).to.be.false
  }
}
