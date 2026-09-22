import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import { plainToInstance } from 'class-transformer'
import * as fs from 'fs'
import * as path from 'path'

import { IConfigParameters } from '@/model/config'
import { MarketplaceEndDto } from '@/model/dto/marketplace-end'
import { EntitlementSignature } from '@/service/entitlement-signature'
import { IInternalRoute, InternalRoute } from '@/service/internal-route'

type Fixture = {
  secret: string
  method: string
  path: string
  header: string
  body: Record<string, unknown>
  serialised: string
  signedBytes: string
  signature: string
  legacySignature: string
}

/** Each contract fixture, and the route this service serves it on. */
const CONTRACTS: ReadonlyArray<{ file: string; route: IInternalRoute }> = [
  { file: 'entitlement-push.contract.json', route: InternalRoute.ENTITLEMENT },
  { file: 'marketplace-hire.contract.json', route: InternalRoute.HIRE },
  { file: 'marketplace-end.contract.json', route: InternalRoute.END },
  {
    file: 'marketplace-milestone-invoice.contract.json',
    route: InternalRoute.MILESTONE_INVOICE,
  },
  { file: 'marketplace-amend.contract.json', route: InternalRoute.AMEND },
  { file: 'marketplace-pause.contract.json', route: InternalRoute.PAUSE },
  {
    file: 'marketplace-settlement.contract.json',
    route: InternalRoute.SETTLEMENT,
  },
  {
    file: 'marketplace-settlement-reversal.contract.json',
    route: InternalRoute.SETTLEMENT_REVERSAL,
  },
]

/**
 * The consuming half of the route binding, over every contract fixture.
 *
 * The marketplace signs each internal call with one shared key, so what
 * keeps a captured call from being replayed on another route is the route
 * named inside the signed bytes. The fixtures - byte-identical copies of
 * the ones web asserts it PRODUCES - carry those bytes and the signature
 * over them; this asserts app derives the same bytes for the route it
 * serves, accepts that signature there and nowhere else, and takes the
 * pre-binding form only inside the one-release window.
 */
@suite()
export class InternalRouteContractTest {
  private fixture(file: string): Fixture {
    return JSON.parse(
      fs.readFileSync(path.join(__dirname, '../fixture', file), 'utf8'),
    )
  }

  private service(secret: string, acceptLegacy: boolean): EntitlementSignature {
    const service = new EntitlementSignature()

    Object.assign(service, {
      parameters: {
        entitlementSecret: secret,
        internalSignatureAcceptLegacy: acceptLegacy,
      } as IConfigParameters,
    })

    return service
  }

  @test()
  eachFixtureNamesTheRouteThisServiceServes() {
    for (const { file, route } of CONTRACTS) {
      const fixture = this.fixture(file)

      expect(
        {
          method: fixture.method,
          path: fixture.path,
          header: fixture.header,
        },
        file,
      ).to.deep.equal(route)
    }
  }

  @test()
  theSignedBytesAreTheOnesThisServiceDerives() {
    for (const { file, route } of CONTRACTS) {
      const fixture = this.fixture(file)

      expect(
        EntitlementSignature.signedBytes(route, fixture.serialised),
        file,
      ).to.equal(fixture.signedBytes)
      expect(
        this.service(fixture.secret, false).sign(route, fixture.serialised),
        file,
      ).to.equal(fixture.signature)
    }
  }

  /**
   * With the legacy window closed, so the answer is the binding's alone:
   * the produced signature opens its own route and not one of the others.
   */
  @test()
  theProducedSignatureOpensItsOwnRouteAndNoOther() {
    for (const { file, route } of CONTRACTS) {
      const fixture = this.fixture(file)
      const service = this.service(fixture.secret, false)

      for (const other of InternalRoute.ALL) {
        expect(
          service.verify(other, fixture.serialised, fixture.signature),
          `${file} on ${other.path}`,
        ).to.equal(other === route)
      }
    }
  }

  /**
   * The rollout window. The legacy signature names no route, which is the
   * hole: it is taken while the switch is on, so a marketplace one release
   * behind keeps working, and refused everywhere once the switch is off.
   */
  @test()
  theLegacySignatureIsTakenOnlyWhileTheWindowIsOpen() {
    for (const { file, route } of CONTRACTS) {
      const fixture = this.fixture(file)

      expect(
        this.service(fixture.secret, true).verify(
          route,
          fixture.serialised,
          fixture.legacySignature,
        ),
        `${file} open`,
      ).to.be.true
      expect(
        this.service(fixture.secret, false).verify(
          route,
          fixture.serialised,
          fixture.legacySignature,
        ),
        `${file} closed`,
      ).to.be.false
    }
  }

  /**
   * Why the binding exists, shown on the fixtures themselves: the DTOs keep
   * keys they do not declare, so a pause - or a hire, or an amendment -
   * parsed as an end re-serialises to the very bytes that were signed. Over
   * the body alone that signature was an end's signature too.
   */
  @test()
  aPauseParsedAsAnEndStillReSerialisesToItsSignedBytes() {
    const pause = this.fixture('marketplace-pause.contract.json')
    const asEnd = plainToInstance(
      MarketplaceEndDto,
      JSON.parse(pause.serialised),
    )
    const service = this.service(pause.secret, false)

    expect(JSON.stringify(asEnd)).to.equal(pause.serialised)
    expect(
      service.verify(InternalRoute.END, JSON.stringify(asEnd), pause.signature),
    ).to.be.false
  }

  /** The end body is what the end DTO parses and gives back unchanged. */
  @test()
  theEndDtoReSerialisesToTheSignedBytes() {
    const fixture = this.fixture('marketplace-end.contract.json')
    const dto = plainToInstance(
      MarketplaceEndDto,
      JSON.parse(fixture.serialised),
    )

    expect(JSON.stringify(fixture.body)).to.equal(fixture.serialised)
    expect(JSON.stringify(dto)).to.equal(fixture.serialised)
  }
}
