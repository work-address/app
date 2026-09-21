import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'

import { Project } from '@/entity/project'
import { Time } from '@/entity/time'
import { IMarketplaceTermsVersion } from '@/model/project'
import { MarketplaceTerms } from '@/service/marketplace-terms'

const CHANGE = '2026-10-05T00:00:00.000Z'

/**
 * Which agreed version governs an hour of work, and which hours one
 * invoice may carry. The rate follows the date the two sides agreed, not
 * the day somebody pressed "invoice".
 */
@suite()
export class MarketplaceTermsTest {
  private project(
    marketplaceTerms: IMarketplaceTermsVersion[] | null,
    rateHour = 45,
  ): Project {
    return Object.assign(new Project(), {
      rateHour,
      weeklyLimit: 20,
      trackScreenshots: false,
      trackProcesses: false,
      marketplaceTerms,
    })
  }

  private version(
    version: number,
    effectiveFrom: string | null,
    rateHour: number,
  ): IMarketplaceTermsVersion {
    return {
      version,
      effectiveFrom,
      rateHour,
      weeklyLimit: 20,
      trackScreenshots: false,
      trackProcesses: false,
    }
  }

  private time(fromAt: string): Time {
    return Object.assign(new Time(), { fromAt: new Date(fromAt) })
  }

  private amended(): Project {
    return this.project(
      [this.version(1, null, 45), this.version(2, CHANGE, 60)],
      60,
    )
  }

  /** The first amendment also records the terms the project was hired on. */
  @test()
  record_keepsTheHiredTermsAsTheFirstVersion() {
    const result = MarketplaceTerms.record(
      this.project(null),
      this.version(2, CHANGE, 60),
    )

    expect(result).to.not.have.property('conflict')
    expect(result).to.deep.include({ changed: true, latest: true })
    expect('versions' in result ? result.versions : []).to.deep.eq([
      this.version(1, null, 45),
      this.version(2, CHANGE, 60),
    ])
  }

  @test()
  record_aRepeatIsNotAChange_andADifferentRepeatIsAConflict() {
    const project = this.amended()

    expect(
      MarketplaceTerms.record(project, this.version(2, CHANGE, 60)),
    ).to.deep.include({ changed: false })
    expect(
      MarketplaceTerms.record(project, this.version(2, CHANGE, 61)),
    ).to.have.property('conflict')
  }

  /** A later version cannot start before the one it follows. */
  @test()
  record_refusesAVersionThatStartsOutOfOrder() {
    expect(
      MarketplaceTerms.record(
        this.amended(),
        this.version(3, '2026-10-04T00:00:00.000Z', 70),
      ),
    ).to.have.property('conflict')

    const late = MarketplaceTerms.record(
      this.project([
        this.version(1, null, 45),
        this.version(3, '2026-10-12T00:00:00.000Z', 70),
      ]),
      this.version(2, CHANGE, 60),
    )

    expect(late).to.deep.include({ changed: true, latest: false })
  }

  @test()
  at_isTheNewestVersionStartedByThen() {
    const project = this.amended()

    expect(
      MarketplaceTerms.at(project, new Date('2026-10-04T23:59:59.999Z'))
        ?.version,
    ).to.eq(1)
    expect(MarketplaceTerms.at(project, new Date(CHANGE))?.version).to.eq(2)
    expect(MarketplaceTerms.at(this.project(null), new Date())).to.be.null
  }

  /**
   * The hours before the change go at the old rate, on their own; the ones
   * after it wait for the next invoice, which bills them at the new rate.
   */
  @test()
  billable_neverMixesTwoRates() {
    const project = this.amended()
    const before = this.time('2026-10-04T22:00:00.000Z')
    const after = this.time('2026-10-05T01:00:00.000Z')

    const first = MarketplaceTerms.billable(project, [after, before])
    const second = MarketplaceTerms.billable(project, [after])

    expect(first.times).to.deep.eq([before])
    expect(first.rateHour).to.eq(45)
    expect(first.until?.toISOString()).to.eq(CHANGE)
    expect(second.times).to.deep.eq([after])
    expect(second.rateHour).to.eq(60)
    expect(second.until).to.be.null
  }

  /** A project that was never amended bills as it always did. */
  @test()
  billable_withoutVersionsUsesTheProjectRate() {
    const times = [this.time('2026-10-04T22:00:00.000Z')]
    const result = MarketplaceTerms.billable(this.project(null, 45), times)

    expect(result).to.deep.eq({ times, rateHour: 45, until: null })
  }
}
