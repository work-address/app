import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import * as fs from 'fs'
import * as path from 'path'

import { MarketplaceHireController } from '@/controller/marketplace-hire-controller'
import { IConfigParameters } from '@/model/config'
import { MarketplaceAmendDto } from '@/model/dto/marketplace-amend'
import { EntitlementSignature } from '@/service/entitlement-signature'

type Fixture = {
  secret: string
  path: string
  header: string
  body: Record<string, unknown>
  serialised: string
  signature: string
}

/**
 * The consuming half of the amendment contract (web WP-85 → app WP-85).
 *
 * The marketplace's HireClient produces the payload in
 * `test/fixture/marketplace-amend.contract.json`, duplicated byte for byte in
 * both repositories, and asserts it does; this asserts app accepts exactly
 * those bytes under that header at that path. The signature is checked over
 * the DTO re-serialised, so a field the DTO dropped would be a term the
 * signature no longer covers.
 */
@suite()
export class MarketplaceAmendContractTest {
  private fixture(): Fixture {
    return JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '../fixture/marketplace-amend.contract.json'),
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
        fixture.serialised,
        fixture.signature,
      ),
    ).to.be.true
    expect(
      this.service('not-the-secret').verify(
        fixture.serialised,
        fixture.signature,
      ),
    ).to.be.false
  }

  @test()
  theDtoReSerialisesToTheSignedBytes() {
    const fixture = this.fixture()
    const dto = plainToInstance(
      MarketplaceAmendDto,
      JSON.parse(fixture.serialised),
    )

    expect(JSON.stringify(fixture.body)).to.equal(fixture.serialised)
    expect(JSON.stringify(dto)).to.equal(fixture.serialised)
  }

  @test()
  async theBodyIsAValidAmendment() {
    const fixture = this.fixture()
    const dto = plainToInstance(MarketplaceAmendDto, fixture.body)

    expect(await validate(dto)).to.deep.equal([])
  }

  /** Version 1 is the hire itself; an amendment is at least version 2. */
  @test()
  async aFirstVersionOrAnImpossibleCapIsRefused() {
    const fixture = this.fixture()

    for (const [field, value] of [
      ['version', 1],
      ['weeklyLimit', 169],
      ['rateHour', -1],
    ] as const) {
      const dto = plainToInstance(MarketplaceAmendDto, {
        ...fixture.body,
        [field]: value,
      })
      const errors = await validate(dto)

      expect(
        errors.map((error) => error.property),
        field,
      ).to.contain(field)
    }
  }

  @test()
  pathAndHeaderAreTheOnesTheControllerServes() {
    const fixture = this.fixture()

    expect(fixture.header).to.equal(
      MarketplaceHireController.AMEND_SIGNATURE_HEADER,
    )
    expect(fixture.path).to.equal('/api/internal/marketplace/amend')
  }
}
