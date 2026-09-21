import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import * as fs from 'fs'
import * as path from 'path'

import { MarketplaceHireController } from '@/controller/marketplace-hire-controller'
import { IConfigParameters } from '@/model/config'
import { MarketplaceHireDto } from '@/model/dto/marketplace-hire'
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
 * The consuming half of the hire contract.
 *
 * The marketplace's HireClient produces the payload in
 * `test/fixture/marketplace-hire.contract.json`, duplicated byte for byte in
 * both repositories, and asserts it does; this asserts app accepts exactly
 * those bytes, under that header, at that path. Neither suite needs the
 * other service running, which is why the contract is a committed file.
 *
 * The sharp part is `theDtoReSerialisesToTheSignedBytes`: the controller
 * checks the HMAC over its own re-serialisation of the parsed DTO, so a
 * field the DTO drops - as it dropped the monitoring flags and the weekly
 * cap before WP-38 - is a field the signature no longer covers.
 */
@suite()
export class MarketplaceHireContractTest {
  private fixture(): Fixture {
    return JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '../fixture/marketplace-hire.contract.json'),
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
      MarketplaceHireDto,
      JSON.parse(fixture.serialised),
    )

    expect(JSON.stringify(fixture.body)).to.equal(fixture.serialised)
    expect(JSON.stringify(dto)).to.equal(fixture.serialised)
  }

  /** Every field the offer agreed is on the DTO, typed, not carried loose. */
  @test()
  theDtoDeclaresTheAgreedTermsItApplies() {
    const fixture = this.fixture()
    const dto = plainToInstance(
      MarketplaceHireDto,
      JSON.parse(fixture.serialised),
    )

    expect(dto.weeklyLimit).to.be.eq(fixture.body.weeklyLimit)
    expect(dto.trackScreenshots).to.be.eq(fixture.body.trackScreenshots)
    expect(dto.trackProcesses).to.be.eq(fixture.body.trackProcesses)
  }

  @test()
  async theBodyIsAValidHire() {
    const fixture = this.fixture()
    const dto = plainToInstance(MarketplaceHireDto, fixture.body)

    expect(await validate(dto)).to.deep.equal([])
  }

  /** A cap above a week's hours, or a fractional one, is not a cap. */
  @test()
  async anImpossibleWeeklyCapIsRefused() {
    const fixture = this.fixture()

    for (const weeklyLimit of [0, 169, 7.5]) {
      const dto = plainToInstance(MarketplaceHireDto, {
        ...fixture.body,
        weeklyLimit,
      })
      const errors = await validate(dto)

      expect(
        errors.map((error) => error.property),
        String(weeklyLimit),
      ).to.contain('weeklyLimit')
    }
  }

  @test()
  pathAndHeaderAreTheOnesTheControllerServes() {
    const fixture = this.fixture()

    expect(fixture.header).to.equal(
      MarketplaceHireController.SIGNATURE_HEADER,
    )
    expect(fixture.path).to.equal('/api/internal/marketplace/hire')
  }
}
