import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import * as fs from 'fs'
import * as path from 'path'

import { MarketplaceSettlementController } from '@/controller/marketplace-settlement-controller'
import { IConfigParameters } from '@/model/config'
import { MarketplaceEscrowBindingDto } from '@/model/dto/marketplace-escrow-binding'
import { IInvoiceEscrowBindingResult } from '@/model/invoice'
import { EntitlementSignature } from '@/service/entitlement-signature'
import { InternalRoute } from '@/service/internal-route'

type Fixture = {
  secret: string
  path: string
  header: string
  body: Record<string, unknown>
  answer: Record<string, unknown>
  serialised: string
  signature: string
}

/**
 * The consuming half of the escrow binding lookup contract
 * (ABANDONED-BINDING).
 *
 * The web service's settlement sweeper produces the request in
 * `test/fixture/marketplace-escrow-binding.contract.json`, duplicated byte
 * for byte in both repositories, and reads the answer there; this asserts
 * app accepts exactly those bytes, under that header, at that path, and
 * answers in that shape, for the allocation the push fixture settles.
 */
@suite()
export class MarketplaceEscrowBindingContractTest {
  private fixture(file = 'marketplace-escrow-binding.contract.json'): Fixture {
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
        InternalRoute.ESCROW_BINDING,
        fixture.serialised,
        fixture.signature,
      ),
    ).to.be.true
    expect(
      this.service('not-the-secret').verify(
        InternalRoute.ESCROW_BINDING,
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
      MarketplaceEscrowBindingDto,
      JSON.parse(fixture.serialised),
    )

    expect(JSON.stringify(fixture.body)).to.equal(fixture.serialised)
    expect(JSON.stringify(dto)).to.equal(fixture.serialised)
  }

  @test()
  async theBodyValidates() {
    const dto = plainToInstance(
      MarketplaceEscrowBindingDto,
      this.fixture().body,
    )

    expect(await validate(dto)).to.deep.equal([])
  }

  /** It asks for the allocation the push fixture settles, and names its invoice. */
  @test()
  itNamesTheAllocationThePushFixtureSettles() {
    const { body, answer } = this.fixture()
    const push = this.fixture('marketplace-settlement.contract.json').body

    expect(Object.keys(body)).to.deep.equal([
      'chainId',
      'escrow',
      'allocationId',
      'issuedAt',
      'nonce',
    ])

    for (const key of ['chainId', 'escrow', 'allocationId']) {
      expect(body[key], key).to.equal(push[key])
    }

    const shaped: IInvoiceEscrowBindingResult = {
      invoiceId: push.invoiceId as string,
    }

    expect(answer).to.deep.equal(shaped)
  }

  @test()
  pathAndHeaderAreTheOnesTheControllerServes() {
    const fixture = this.fixture()

    expect(fixture.header).to.equal(
      MarketplaceSettlementController.BINDING_SIGNATURE_HEADER,
    )
    expect(fixture.path).to.equal('/api/internal/marketplace/escrow-binding')
  }
}
