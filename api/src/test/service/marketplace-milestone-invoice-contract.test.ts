import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import * as fs from 'fs'
import * as path from 'path'

import { MarketplaceHireController } from '@/controller/marketplace-hire-controller'
import { IConfigParameters } from '@/model/config'
import { MarketplaceMilestoneInvoiceDto } from '@/model/dto/marketplace-milestone'
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
 * The consuming half of the milestone invoice contract (web WP-93 → app
 * MS-03).
 *
 * The marketplace's MilestoneInvoiceClient produces the payload in
 * `test/fixture/marketplace-milestone-invoice.contract.json`, duplicated byte
 * for byte in both repositories, and asserts it does; this asserts app
 * accepts exactly those bytes under that header at that path. The signature
 * is checked over the DTO re-serialised, so the sum, the freelancer and the
 * reference that make a bill what it is are all inside what was signed.
 */
@suite()
export class MarketplaceMilestoneInvoiceContractTest {
  private fixture(): Fixture {
    return JSON.parse(
      fs.readFileSync(
        path.join(
          __dirname,
          '../fixture/marketplace-milestone-invoice.contract.json',
        ),
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
      MarketplaceMilestoneInvoiceDto,
      JSON.parse(fixture.serialised),
    )

    expect(JSON.stringify(fixture.body)).to.equal(fixture.serialised)
    expect(JSON.stringify(dto)).to.equal(fixture.serialised)
  }

  @test()
  async theBodyIsAValidMilestoneBill() {
    const fixture = this.fixture()
    const dto = plainToInstance(MarketplaceMilestoneInvoiceDto, fixture.body)

    expect(await validate(dto)).to.deep.equal([])
  }

  /** A sum the marketplace changed after signing is a different signature. */
  @test()
  signsTheSumTheFreelancerAndTheReference() {
    const fixture = this.fixture()
    const service = this.service(fixture.secret)

    for (const [field, value] of [
      ['amountCents', 40001],
      ['freelancerId', '00000000-0000-4000-8000-000000000000'],
      ['milestoneRef', '00000000-0000-4000-8000-000000000000'],
      ['contractId', '00000000-0000-4000-8000-000000000000'],
    ] as const) {
      expect(
        service.verify(
          JSON.stringify({ ...fixture.body, [field]: value }),
          fixture.signature,
        ),
        field,
      ).to.be.false
    }
  }

  @test()
  pathAndHeaderAreTheOnesTheControllerServes() {
    const fixture = this.fixture()

    expect(fixture.header).to.equal(
      MarketplaceHireController.MILESTONE_SIGNATURE_HEADER,
    )
    expect(fixture.path).to.equal('/api/internal/marketplace/milestone-invoice')
  }
}
