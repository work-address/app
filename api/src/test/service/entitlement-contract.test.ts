import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import * as fs from 'fs'
import * as path from 'path'

import { EntitlementSignature } from '@/service/entitlement-signature'
import { IConfigParameters } from '@/model/config'

/**
 * The consuming half of the cross-repo contract.
 *
 * `web` produces the payload in `test/fixture/entitlement-push.contract.json`, duplicated in both repos,
 * and asserts it does; this asserts `app` accepts exactly that. Both suites run
 * in ordinary CI without standing up the other service, which is why the
 * contract lives in a committed fixture rather than in an end-to-end test that
 * needs two stacks and a database each.
 *
 * If this fails, the two services have diverged on the wire format and the
 * entitlement loop is broken in production - not in a way either suite would
 * otherwise notice.
 */
@suite()
export class EntitlementContractTest {
  private fixture(): {
    secret: string
    serialised: string
    signature: string
    body: Record<string, unknown>
  } {
    return JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '../fixture/entitlement-push.contract.json'),
        'utf8',
      ),
    )
  }

  private service(secret: string): EntitlementSignature {
    const service = new EntitlementSignature()

    Object.assign(service, {
      parameters: { entitlementSecret: secret } as IConfigParameters,
    })

    return service
  }

  @test()
  acceptsTheSignatureTheBillingServiceProduces() {
    const fixture = this.fixture()
    const service = this.service(fixture.secret)

    expect(service.verify(fixture.serialised, fixture.signature)).to.be.true
  }

  /**
   * The signature covers the exact bytes sent, so key order is part of the
   * contract. Re-serialising the parsed body must reproduce them.
   */
  @test()
  reSerialisingTheParsedBodyReproducesTheSignedBytes() {
    const fixture = this.fixture()

    expect(JSON.stringify(fixture.body)).to.be.equal(fixture.serialised)
  }

  @test()
  rejectsTheSameBodyUnderADifferentSecret() {
    const fixture = this.fixture()

    expect(
      this.service('not-the-secret').verify(
        fixture.serialised,
        fixture.signature,
      ),
    ).to.be.false
  }
}
