import * as crypto from 'crypto'
import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'

import { EntitlementSignature } from '@/service/entitlement-signature'
import { InternalRoute } from '@/service/internal-route'
import { IConfigParameters } from '@/model/config'

@suite()
export class EntitlementSignatureTest {
  private build(
    entitlementSecret: string,
    internalSignatureAcceptLegacy: boolean = true,
  ): EntitlementSignature {
    const service = new EntitlementSignature()

    Object.assign(service, {
      parameters: {
        entitlementSecret,
        internalSignatureAcceptLegacy,
      } as IConfigParameters,
    })

    return service
  }

  @test()
  verify_acceptsItsOwnSignature() {
    const service = this.build('shared')
    const body = JSON.stringify({ userId: 'a', premium: true })
    const route = InternalRoute.ENTITLEMENT

    expect(service.verify(route, body, service.sign(route, body))).to.be.true
  }

  @test()
  verify_rejectsATamperedBody() {
    const service = this.build('shared')
    const route = InternalRoute.ENTITLEMENT
    const signature = service.sign(route, JSON.stringify({ premium: false }))

    expect(service.verify(route, JSON.stringify({ premium: true }), signature))
      .to.be.false
  }

  @test()
  verify_rejectsASignatureFromADifferentSecret() {
    const body = JSON.stringify({ premium: true })
    const route = InternalRoute.ENTITLEMENT
    const signature = this.build('other-secret').sign(route, body)

    expect(this.build('shared').verify(route, body, signature)).to.be.false
  }

  @test()
  verify_rejectsMissingOrMalformedSignatures() {
    const service = this.build('shared')
    const body = JSON.stringify({ premium: true })
    const route = InternalRoute.ENTITLEMENT

    expect(service.verify(route, body, '')).to.be.false
    expect(service.verify(route, body, 'short')).to.be.false
    expect(service.verify(route, body, 'v2=')).to.be.false
    expect(service.verify(route, body, 'v2=short')).to.be.false
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
    const route = InternalRoute.ENTITLEMENT

    expect(service.verify(route, body, service.sign(route, body))).to.be.false
    expect(service.verify(route, body, service.signLegacy(body))).to.be.false
    expect(service.verify(route, body, '')).to.be.false
  }

  /**
   * The point of the binding: one key signs every internal route, so the
   * same bytes signed for one of them must open none of the others. Every
   * ordered pair, because a table with a repeated path or header would make
   * two routes interchangeable without any single route looking wrong.
   */
  @test()
  verify_refusesOnEveryOtherRouteWhatWasSignedForOne() {
    const service = this.build('shared')
    const body = JSON.stringify({ contractId: 'c', issuedAt: 1, nonce: 'n' })

    for (const signedFor of InternalRoute.ALL) {
      const signature = service.sign(signedFor, body)

      for (const sentTo of InternalRoute.ALL) {
        expect(
          service.verify(sentTo, body, signature),
          `${signedFor.path} -> ${sentTo.path}`,
        ).to.be.eq(signedFor === sentTo)
      }
    }
  }

  /** Each of the three route values is in the signed bytes on its own. */
  @test()
  verify_bindsTheMethodThePathAndTheHeaderSeparately() {
    const service = this.build('shared')
    const body = JSON.stringify({ premium: true })
    const route = InternalRoute.HIRE
    const signature = service.sign(route, body)

    expect(
      service.verify({ ...route, path: `${route.path}/` }, body, signature),
    ).to.be.false
    expect(
      service.verify(
        { ...route, header: InternalRoute.END.header },
        body,
        signature,
      ),
    ).to.be.false
    expect(
      service.verify(
        { ...route, method: 'PUT' as unknown as 'POST' },
        body,
        signature,
      ),
    ).to.be.false
    // Header names are case-insensitive on the wire, so their case is not
    // part of the contract.
    expect(
      service.verify(
        { ...route, header: route.header.toUpperCase() },
        body,
        signature,
      ),
    ).to.be.true
  }

  /** The exact layout, so the two repositories cannot drift apart on it. */
  @test()
  sign_coversTheVersionTheRouteAndTheBodyOnePerLine() {
    const body = '{"a":1}'
    const bytes = EntitlementSignature.signedBytes(InternalRoute.PAUSE, body)
    const digest = crypto
      .createHmac('sha256', 'shared')
      .update(bytes)
      .digest('hex')

    expect(bytes).to.be.eq(
      'v2\nPOST\n/api/internal/marketplace/pause\nx-marketplace-pause-signature\n{"a":1}',
    )
    expect(this.build('shared').sign(InternalRoute.PAUSE, body)).to.be.eq(
      `v2=${digest}`,
    )
  }

  /**
   * The one-release window: the form callers sent before the binding is
   * accepted while the switch is on and refused once it is off. A `v2`
   * signature does not depend on the switch either way.
   */
  @test()
  verify_acceptsTheLegacyFormOnlyWhileTheSwitchIsOn() {
    const body = JSON.stringify({ premium: true })
    const route = InternalRoute.ENTITLEMENT
    const open = this.build('shared', true)
    const closed = this.build('shared', false)
    const legacy = open.signLegacy(body)

    expect(open.verify(route, body, legacy)).to.be.true
    expect(closed.verify(route, body, legacy)).to.be.false
    expect(closed.verify(route, body, closed.sign(route, body))).to.be.true
  }

  /**
   * A value that names a version is held to it: the digest of a v2
   * signature with its prefix stripped is not a legacy signature, and a
   * legacy digest dressed as v2 is not a v2 one.
   */
  @test()
  verify_neverReadsOneFormAsTheOther() {
    const service = this.build('shared', true)
    const body = JSON.stringify({ premium: true })
    const route = InternalRoute.ENTITLEMENT
    const stripped = service.sign(route, body).slice('v2='.length)

    expect(service.verify(route, body, stripped)).to.be.false
    expect(service.verify(route, body, `v2=${service.signLegacy(body)}`)).to.be
      .false
    expect(service.verify(route, body, `v1=${service.signLegacy(body)}`)).to.be
      .false
  }

  /** No two routes may share a path or a header, or binding them is moot. */
  @test()
  routes_areDistinctInPathAndHeader() {
    const paths = InternalRoute.ALL.map((route) => route.path)
    const headers = InternalRoute.ALL.map((route) => route.header.toLowerCase())

    expect(new Set(paths).size).to.be.eq(InternalRoute.ALL.length)
    expect(new Set(headers).size).to.be.eq(InternalRoute.ALL.length)
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
