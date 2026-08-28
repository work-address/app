import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'

import { EntitlementSignature } from '@/service/entitlement-signature'
import { IConfigParameters } from '@/model/config'

@suite()
export class EntitlementSignatureTest {
  private build(entitlementSecret: string): EntitlementSignature {
    const service = new EntitlementSignature()

    Object.assign(service, {
      parameters: { entitlementSecret } as IConfigParameters,
    })

    return service
  }

  @test()
  verify_acceptsItsOwnSignature() {
    const service = this.build('shared')
    const body = JSON.stringify({ userId: 'a', premium: true })

    expect(service.verify(body, service.sign(body))).to.be.true
  }

  @test()
  verify_rejectsATamperedBody() {
    const service = this.build('shared')
    const signature = service.sign(JSON.stringify({ premium: false }))

    expect(service.verify(JSON.stringify({ premium: true }), signature)).to.be
      .false
  }

  @test()
  verify_rejectsASignatureFromADifferentSecret() {
    const body = JSON.stringify({ premium: true })
    const signature = this.build('other-secret').sign(body)

    expect(this.build('shared').verify(body, signature)).to.be.false
  }

  @test()
  verify_rejectsMissingOrMalformedSignatures() {
    const service = this.build('shared')
    const body = JSON.stringify({ premium: true })

    expect(service.verify(body, '')).to.be.false
    expect(service.verify(body, 'short')).to.be.false
  }

  /**
   * A self-hosted instance has no secret. Every push must fail closed rather
   * than accepting an empty signature against an empty key - entitlement there
   * comes from Entitlement.isSaaS() being false, never from a request.
   */
  @test()
  verify_failsClosedWithNoSecretConfigured() {
    const service = this.build('')
    const body = JSON.stringify({ premium: true })

    expect(service.verify(body, service.sign(body))).to.be.false
    expect(service.verify(body, '')).to.be.false
  }

  @test()
  replayWindow_acceptsFreshAndRejectsStaleOrFuture() {
    const service = this.build('shared')
    const now = Date.now()
    const nowSeconds = Math.floor(now / 1000)

    expect(service.isWithinReplayWindow(nowSeconds, now)).to.be.true
    expect(service.isWithinReplayWindow(nowSeconds - 299, now)).to.be.true
    expect(service.isWithinReplayWindow(nowSeconds - 301, now)).to.be.false
    // Clock skew cuts both ways, but an issuedAt far in the future is a
    // request being held for later replay.
    expect(service.isWithinReplayWindow(nowSeconds + 301, now)).to.be.false
  }
}
