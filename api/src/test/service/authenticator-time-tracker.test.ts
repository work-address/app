import { expect } from 'chai'
import { suite, test } from '@testdeck/mocha'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { AuthenticatorTimeTracker } from '@/service/auth/authenticator-time-tracker'
import { EAuthTimeTrackerState } from '@/model/auth'
import { RedisClient } from '@/service/redis-client'

/**
 * The pairing nonce is pinned to the address that created it. These cover the
 * address changes a real client makes between two steps of the hand-off, which
 * the pin has to let through.
 */
@suite()
export class AuthenticatorTimeTrackerTest extends AbstractDatabaseIntegration {
  protected authenticatorTimeTracker: AuthenticatorTimeTracker
  protected redisClient: RedisClient

  constructor() {
    super()

    this.authenticatorTimeTracker = this.container.get(
      'AuthenticatorTimeTracker',
    )
    this.redisClient = this.container.get('RedisClient')
  }

  /** A dual-stack browser races the two families and does not always win twice. */
  @test()
  async loginSurvivesASwitchFromIpv6ToIpv4() {
    const nonce = await this.authenticatorTimeTracker.timeTrackerNonceGenerate(
      '2a0c:5d00:3002::1:ddaa:57f5',
    )

    await this.authenticatorTimeTracker.timeTrackerLogin(
      nonce.nonce,
      '91.186.222.245',
    )

    const cached = (await this.redisClient.get(
      `timetracker:nonce:${nonce.nonce}`,
    )) as { state: EAuthTimeTrackerState }

    expect(cached.state).to.be.equal(EAuthTimeTrackerState.LOGIN)
  }

  /** IPv6 privacy extensions rotate the host half of the address. */
  @test()
  async nonceGetSurvivesARotationInsideTheSamePrefix() {
    const nonce = await this.authenticatorTimeTracker.timeTrackerNonceGenerate(
      '2a0c:5d00:3002::1:ddaa:57f5',
    )

    const read = await this.authenticatorTimeTracker.timeTrackerNonceGet(
      nonce.nonce,
      '2a0c:5d00:3002:0:aaaa:bbbb:cccc:dddd',
    )

    expect(read.state).to.be.equal(EAuthTimeTrackerState.INIT)
  }

  @test()
  async loginStillRejectsAnUnrelatedAddress() {
    const nonce =
      await this.authenticatorTimeTracker.timeTrackerNonceGenerate(
        '91.186.222.245',
      )

    let error: unknown

    try {
      await this.authenticatorTimeTracker.timeTrackerLogin(
        nonce.nonce,
        '203.0.113.7',
      )
    } catch (e: unknown) {
      error = e
    }

    expect(error).to.be.ok
    expect(String((error as Error).message)).to.match(/IP address mismatch/)
  }

  @test()
  async loginStillRejectsAnUnrelatedIpv6Prefix() {
    const nonce =
      await this.authenticatorTimeTracker.timeTrackerNonceGenerate(
        '2a0c:5d00:3002::1',
      )

    let error: unknown

    try {
      await this.authenticatorTimeTracker.timeTrackerLogin(
        nonce.nonce,
        '2a0c:5d00:9999::1',
      )
    } catch (e: unknown) {
      error = e
    }

    expect(error).to.be.ok
    expect(String((error as Error).message)).to.match(/IP address mismatch/)
  }
}
