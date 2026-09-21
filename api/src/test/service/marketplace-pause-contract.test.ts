import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import * as fs from 'fs'
import * as path from 'path'

import { MarketplaceHireController } from '@/controller/marketplace-hire-controller'
import { IConfigParameters } from '@/model/config'
import { MarketplacePauseDto } from '@/model/dto/marketplace-pause'
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
 * The consuming half of the pause contract (web WP-86 → app WP-86).
 *
 * The marketplace's HireClient produces the payload in
 * `test/fixture/marketplace-pause.contract.json`, duplicated byte for byte in
 * both repositories, and asserts it does; this asserts app accepts exactly
 * those bytes under that header at that path. The signature is checked over
 * the DTO re-serialised, so the sequence that orders pauses and resumes is
 * inside what was signed.
 */
@suite()
export class MarketplacePauseContractTest {
  private fixture(): Fixture {
    return JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '../fixture/marketplace-pause.contract.json'),
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
      MarketplacePauseDto,
      JSON.parse(fixture.serialised),
    )

    expect(JSON.stringify(fixture.body)).to.equal(fixture.serialised)
    expect(JSON.stringify(dto)).to.equal(fixture.serialised)
  }

  @test()
  async theBodyIsAValidPause() {
    const fixture = this.fixture()
    const dto = plainToInstance(MarketplacePauseDto, fixture.body)

    expect(await validate(dto)).to.deep.equal([])
  }

  /** Every move has a place in the order; there is no move zero. */
  @test()
  async aSequenceBelowOneOrAMissingStateIsRefused() {
    const fixture = this.fixture()

    for (const [field, value] of [
      ['sequence', 0],
      ['paused', 'yes'],
    ] as const) {
      const dto = plainToInstance(MarketplacePauseDto, {
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
      MarketplaceHireController.PAUSE_SIGNATURE_HEADER,
    )
    expect(fixture.path).to.equal('/api/internal/marketplace/pause')
  }
}
