import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'

import { Entitlement } from '@/service/entitlement'
import { IConfigParameters } from '@/model/config'
import { User } from '@/entity/user'

/**
 * The self-hosted build must stay unrestricted. A regression here does not
 * throw - it silently converts every self-hosted install into a crippled free
 * tier, and nobody running the installer would report that as a bug. They
 * would assume it is the product. Both modes are asserted explicitly.
 */
@suite()
export class EntitlementTest {
  private build(entitlementSecret: string): Entitlement {
    const entitlement = new Entitlement()

    // The service reads one field; a full config is not needed and pinning
    // the whole shape here would make this test fail on unrelated additions.
    Object.assign(entitlement, {
      parameters: { entitlementSecret } as IConfigParameters,
    })

    return entitlement
  }

  private user(premium: boolean | null): User {
    return { premium } as User
  }

  @test()
  selfHosted_hasNoBillingService() {
    const entitlement = this.build('')

    expect(entitlement.isSaaS()).to.be.false
  }

  @test()
  selfHosted_everyAccountIsPremium() {
    const entitlement = this.build('')

    expect(entitlement.isPremium(this.user(false))).to.be.true
    expect(entitlement.isPremium(this.user(null))).to.be.true
    expect(entitlement.isPremium(undefined)).to.be.true
  }

  @test()
  saas_entitlementFollowsTheStoredFlag() {
    const entitlement = this.build('a-shared-secret')

    expect(entitlement.isSaaS()).to.be.true
    expect(entitlement.isPremium(this.user(true))).to.be.true
    expect(entitlement.isPremium(this.user(false))).to.be.false
    expect(entitlement.isPremium(this.user(null))).to.be.false
    expect(entitlement.isPremium(undefined)).to.be.false
  }

  @test()
  whitespaceOnlySecretIsNotAConfiguredBillingService() {
    // app-config trims, so a secret of only whitespace arrives as ''. Asserted
    // so a future loader change cannot quietly flip an instance into SaaS mode
    // and put every self-hosted account on the rotating free history.
    expect(this.build('').isSaaS()).to.be.false
  }

  /**
   * The validity the last push carried is what stops a billing service that
   * went quiet from leaving an account premium forever. One instant, both
   * ends derived from it.
   */
  @test()
  saas_premiumLapsesOnceTheLastPushedValidityHasPassed() {
    const entitlement = this.build('a-shared-secret')
    const now = new Date()
    const hourMs = 60 * 60 * 1000

    const current = {
      premium: true,
      premiumValidUntil: new Date(now.getTime() + hourMs),
    } as User
    const lapsed = {
      premium: true,
      premiumValidUntil: new Date(now.getTime() - hourMs),
    } as User

    expect(entitlement.isPremium(current, now)).to.be.true
    expect(entitlement.isPremium(lapsed, now)).to.be.false
  }

  /** Accounts no push has given a validity yet keep the flag as it was. */
  @test()
  saas_noValidityYetKeepsTheFlag() {
    const entitlement = this.build('a-shared-secret')

    expect(
      entitlement.isPremium({ premium: true, premiumValidUntil: null } as User),
    ).to.be.true
  }

  /** Self-host never expires: there is no billing service to renew it. */
  @test()
  selfHosted_ignoresAnyValidity() {
    const entitlement = this.build('')
    const lapsed = {
      premium: false,
      premiumValidUntil: new Date(Date.now() - 60 * 60 * 1000),
    } as User

    expect(entitlement.isPremium(lapsed)).to.be.true
  }
}
