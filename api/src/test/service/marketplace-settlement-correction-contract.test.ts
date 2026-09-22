import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import * as fs from 'fs'
import * as path from 'path'

import { MarketplaceSettlementController } from '@/controller/marketplace-settlement-controller'
import { IConfigParameters } from '@/model/config'
import { MarketplaceSettlementCorrectionDto } from '@/model/dto/marketplace-settlement-correction'
import { EntitlementSignature } from '@/service/entitlement-signature'
import { InternalRoute } from '@/service/internal-route'
import { InvoiceEscrow } from '@/service/invoice-escrow'

type Fixture = {
  secret: string
  path: string
  header: string
  body: Record<string, unknown>
  serialised: string
  signature: string
}

/**
 * The consuming half of the settlement correction contract (PARTIAL-REORG).
 *
 * The web service's settlement sweeper produces the payload in
 * `test/fixture/marketplace-settlement-correction.contract.json`, duplicated
 * byte for byte in both repositories, and asserts it does; this asserts app
 * accepts exactly those bytes, under that header, at that path, and that
 * they correct the release the push fixture recorded.
 */
@suite()
export class MarketplaceSettlementCorrectionContractTest {
  private fixture(
    file = 'marketplace-settlement-correction.contract.json',
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
        InternalRoute.SETTLEMENT_CORRECTION,
        fixture.serialised,
        fixture.signature,
      ),
    ).to.be.true
    expect(
      this.service(fixture.secret).verify(
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
      MarketplaceSettlementCorrectionDto,
      JSON.parse(fixture.serialised),
    )

    expect(JSON.stringify(fixture.body)).to.equal(fixture.serialised)
    expect(JSON.stringify(dto)).to.equal(fixture.serialised)
  }

  /** It validates, and is a correction the escrow's history allows. */
  @test()
  async theBodyValidates() {
    const dto = plainToInstance(
      MarketplaceSettlementCorrectionDto,
      this.fixture().body,
    )

    expect(await validate(dto)).to.deep.equal([])
    expect(InvoiceEscrow.correctionProblem(dto)).to.equal(null)
  }

  /** It corrects the release the push fixture recorded, and nothing else. */
  @test()
  itNamesTheReleaseThePushFixtureRecorded() {
    const correction = this.fixture().body
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
      'txHash',
    ]

    expect(Object.keys(correction)).to.deep.equal([
      ...named.slice(0, 8),
      'refundedBaseUnits',
      'txHash',
      'correctedRefundedBaseUnits',
      'issuedAt',
      'nonce',
    ])

    for (const key of named) {
      expect(correction[key], key).to.equal(push[key])
    }

    expect(correction.correctedRefundedBaseUnits).to.equal(
      push.refundedBaseUnits,
    )
  }

  @test()
  pathAndHeaderAreTheOnesTheControllerServes() {
    const fixture = this.fixture()

    expect(fixture.header).to.equal(
      MarketplaceSettlementController.CORRECTION_SIGNATURE_HEADER,
    )
    expect(fixture.path).to.equal(
      '/api/internal/marketplace/settlement-correction',
    )
  }
}
