import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import * as fs from 'fs'
import * as path from 'path'

import { MarketplaceSettlementController } from '@/controller/marketplace-settlement-controller'
import { IConfigParameters } from '@/model/config'
import { MarketplaceSettlementDto } from '@/model/dto/marketplace-settlement'
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
 * The consuming half of the settlement push contract.
 *
 * The web service's escrow indexer produces the payload in
 * `test/fixture/marketplace-settlement.contract.json`, duplicated byte for
 * byte in both repositories, and asserts it does; this asserts app accepts
 * exactly those bytes, under that header, at that path. Neither suite needs
 * the other service running, which is why the contract is a committed file.
 */
@suite()
export class MarketplaceSettlementContractTest {
  private fixture(): Fixture {
    return JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '../fixture/marketplace-settlement.contract.json'),
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
  acceptsTheSignatureTheMarketplaceProduces() {
    const fixture = this.fixture()

    expect(
      this.service(fixture.secret).verify(
        InternalRoute.SETTLEMENT,
        fixture.serialised,
        fixture.signature,
      ),
    ).to.be.true
    expect(
      this.service('not-the-secret').verify(
        InternalRoute.SETTLEMENT,
        fixture.serialised,
        fixture.signature,
      ),
    ).to.be.false
  }

  /**
   * The controller verifies the signature over the body as it re-serialises
   * the DTO it was given, so the DTO must reproduce the signed bytes exactly:
   * same keys, same order, same values, nulls kept.
   */
  @test()
  theDtoReSerialisesToTheSignedBytes() {
    const fixture = this.fixture()
    const dto = plainToInstance(
      MarketplaceSettlementDto,
      JSON.parse(fixture.serialised),
    )

    expect(JSON.stringify(fixture.body)).to.equal(fixture.serialised)
    expect(JSON.stringify(dto)).to.equal(fixture.serialised)
  }

  @test()
  async theBodyIsAValidSettlement() {
    const fixture = this.fixture()
    const dto = plainToInstance(MarketplaceSettlementDto, fixture.body)

    expect(await validate(dto)).to.deep.equal([])
    expect(InvoiceEscrow.settlementProblem(dto)).to.be.null
  }

  @test()
  pathAndHeaderAreTheOnesTheControllerServes() {
    const fixture = this.fixture()

    expect(fixture.header).to.equal(
      MarketplaceSettlementController.SIGNATURE_HEADER,
    )
    expect(fixture.path).to.equal('/api/internal/marketplace/settlement')
  }
}
