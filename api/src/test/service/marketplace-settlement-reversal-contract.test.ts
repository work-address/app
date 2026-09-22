import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import * as fs from 'fs'
import * as path from 'path'

import { MarketplaceSettlementController } from '@/controller/marketplace-settlement-controller'
import { IConfigParameters } from '@/model/config'
import { MarketplaceSettlementReversalDto } from '@/model/dto/marketplace-settlement-reversal'
import { EntitlementSignature } from '@/service/entitlement-signature'
import { InternalRoute } from '@/service/internal-route'

type Fixture = {
  secret: string
  path: string
  header: string
  body: Record<string, unknown>
  serialised: string
  signature: string
}

/**
 * The consuming half of the settlement reversal contract.
 *
 * The web service's settlement sweeper produces the payload in
 * `test/fixture/marketplace-settlement-reversal.contract.json`, duplicated
 * byte for byte in both repositories, and asserts it does; this asserts app
 * accepts exactly those bytes, under that header, at that path, and that
 * they name the settlement the push fixture recorded.
 */
@suite()
export class MarketplaceSettlementReversalContractTest {
  private fixture(
    file = 'marketplace-settlement-reversal.contract.json',
  ): Fixture {
    return JSON.parse(
      fs.readFileSync(path.join(__dirname, '../fixture', file), 'utf8'),
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
  acceptsTheSignatureTheMarketplaceProduces() {
    const fixture = this.fixture()

    expect(
      this.service(fixture.secret).verify(
        InternalRoute.SETTLEMENT_REVERSAL,
        fixture.serialised,
        fixture.signature,
      ),
    ).to.be.true
    expect(
      this.service('not-the-secret').verify(
        InternalRoute.SETTLEMENT_REVERSAL,
        fixture.serialised,
        fixture.signature,
      ),
    ).to.be.false
  }

  /**
   * The controller verifies the signature over the body as it re-serialises
   * the DTO it was given, so the DTO must reproduce the signed bytes exactly.
   */
  @test()
  theDtoReSerialisesToTheSignedBytes() {
    const fixture = this.fixture()
    const dto = plainToInstance(
      MarketplaceSettlementReversalDto,
      JSON.parse(fixture.serialised),
    )

    expect(JSON.stringify(fixture.body)).to.equal(fixture.serialised)
    expect(JSON.stringify(dto)).to.equal(fixture.serialised)
  }

  @test()
  async theBodyValidates() {
    const fixture = this.fixture()
    const dto = plainToInstance(MarketplaceSettlementReversalDto, fixture.body)

    expect(await validate(dto)).to.deep.equal([])
  }

  /** It reverses exactly the settlement the push fixture recorded. */
  @test()
  itNamesTheSettlementThePushFixtureRecorded() {
    const reversal = this.fixture().body
    const push = this.fixture('marketplace-settlement.contract.json').body
    const named = [
      'invoiceId',
      'chainId',
      'escrow',
      'allocationId',
      'escrowState',
      'grossBaseUnits',
      'feeBaseUnits',
      'netBaseUnits',
      'refundedBaseUnits',
      'txHash',
    ]

    expect(Object.keys(reversal)).to.deep.equal([...named, 'issuedAt', 'nonce'])

    for (const key of named) {
      expect(reversal[key], key).to.equal(push[key])
    }
  }

  @test()
  pathAndHeaderAreTheOnesTheControllerServes() {
    const fixture = this.fixture()

    expect(fixture.header).to.equal(
      MarketplaceSettlementController.REVERSAL_SIGNATURE_HEADER,
    )
    expect(fixture.path).to.equal(
      '/api/internal/marketplace/settlement-reversal',
    )
  }
}
