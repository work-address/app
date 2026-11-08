import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import * as fs from 'fs'
import * as path from 'path'

import { EntitlementSignature } from '@/service/entitlement-signature'
import { IConfigParameters } from '@/model/config'

/**
 * The consuming half of the seat lookup: `web` asserts it produces the request
 * in `test/fixture/seat-inventory.contract.json`, and this that `app` accepts it.
 * The fixture is duplicated byte-for-byte in both repositories.
 */
@suite()
export class SeatInventoryContractTest {
  private fixture(): {
    secret: string
    serialised: string
    signature: string
    body: Record<string, unknown>
    response: Record<string, unknown>
  } {
    return JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '../fixture/seat-inventory.contract.json'),
        'utf8',
      ),
    )
  }

  @test()
  acceptsWhatTheBillingServiceSigns() {
    const fixture = this.fixture()
    const service = new EntitlementSignature()

    Object.assign(service, {
      parameters: { entitlementSecret: fixture.secret } as IConfigParameters,
    })

    expect(service.verify(fixture.serialised, fixture.signature)).to.be.true
    expect(JSON.stringify(fixture.body)).to.equal(fixture.serialised)
  }

  @test()
  answersInTheShapeBillingReads() {
    expect(Object.keys(this.fixture().response).sort()).to.deep.equal([
      'connected',
      'ownerEmail',
      'seats',
      'workers',
    ])
  }
}
