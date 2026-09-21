import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'

import {
  EIdentityChainResult,
  IIdentityChainRead,
  IIdentityPresentationRef,
} from '@/model/identity'
import { IdentityReadCache } from '@/service/identity-read-cache'

const READ: IIdentityChainRead = {
  status: {
    result: EIdentityChainResult.CURRENT,
    subjectDeactivated: false,
    checkedAtBlock: 1,
    finalized: true,
    unavailable: null,
  },
  history: [],
}

const refFor = (subject: string): IIdentityPresentationRef => ({
  registry: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  subject,
  version: 1,
  commitment: '0xabc',
  schemaId: 1,
})

/** A distinct subject per index, in the shape the route keys on. */
const subjectOf = (index: number): string =>
  `did:pkh:eip155:31337:0x${index.toString(16).padStart(40, '0')}`

/**
 * IDENTITY-FOLLOWUPS (1): the cache behind the public profile route is
 * bounded.
 *
 * It used to drop an entry only when the *same* subject was read again after
 * its window closed, so a crawler walking every public profile once left one
 * entry per address it had ever seen for the life of the process. Two bounds
 * now hold: expired entries are swept on a fixed cadence of writes, and a
 * burst faster than that sweep is capped at a known ceiling.
 */
@suite()
export class IdentityReadCacheTest {
  private cache: IdentityReadCache

  before() {
    this.cache = new IdentityReadCache()
  }

  /** It is still a cache: a warm subject is answered without a chain read. */
  @test()
  answersAWarmSubject() {
    const subject = subjectOf(1)

    this.cache.set(subject, refFor(subject), READ)

    expect(this.cache.get(subject, refFor(subject))).to.deep.equal(READ)
    expect(this.cache.size).to.equal(1)
  }

  /**
   * The regression, stated as the bound it broke: read many subjects once
   * each, never read any of them again, and the map does not keep them.
   *
   * The window is a millisecond and the run waits past it, so what is left
   * afterwards does not depend on how fast the machine is.
   */
  @test()
  async expiredEntries_areSweptWithoutBeingReadAgain() {
    this.cache.ttlMs = 1

    for (let index = 0; index < IdentityReadCache.SWEEP_EVERY - 1; index += 1) {
      const subject = subjectOf(index)

      this.cache.set(subject, refFor(subject), READ)
    }

    expect(this.cache.size).to.equal(IdentityReadCache.SWEEP_EVERY - 1)

    await new Promise((resolve) => setTimeout(resolve, 20))

    // The write that completes the sweep cadence. Its own window is open, so
    // it is the one entry that survives.
    this.cache.ttlMs = IdentityReadCache.DEFAULT_TTL_MS

    const fresh = subjectOf(IdentityReadCache.SWEEP_EVERY)

    this.cache.set(fresh, refFor(fresh), READ)

    expect(this.cache.size, 'everything expired was swept').to.equal(1)
    expect(this.cache.get(fresh, refFor(fresh))).to.deep.equal(READ)
  }

  /** And the sweep can be run outright, which is what the cadence calls. */
  @test()
  sweep_dropsOnlyWhatHasExpired() {
    const stale = subjectOf(1)
    const warm = subjectOf(2)

    this.cache.ttlMs = 1
    this.cache.set(stale, refFor(stale), READ)
    this.cache.ttlMs = 60000
    this.cache.set(warm, refFor(warm), READ)

    this.cache.sweep(Date.now() + 10)

    expect(this.cache.size).to.equal(1)
    expect(this.cache.get(warm, refFor(warm))).to.deep.equal(READ)
    expect(this.cache.get(stale, refFor(stale))).to.equal(null)
  }

  /**
   * A burst faster than the sweep - every entry still inside its window -
   * cannot take the map past its ceiling, and what goes is the oldest.
   */
  @test()
  aBurstInsideOneWindow_isCappedAtTheCeiling() {
    const over = IdentityReadCache.MAX_ENTRIES + 50

    for (let index = 0; index < over; index += 1) {
      const subject = subjectOf(index)

      this.cache.set(subject, refFor(subject), READ)
    }

    expect(this.cache.size).to.equal(IdentityReadCache.MAX_ENTRIES)
    expect(
      this.cache.get(subjectOf(0), refFor(subjectOf(0))),
      'the oldest entry made room',
    ).to.equal(null)
    expect(
      this.cache.get(subjectOf(over - 1), refFor(subjectOf(over - 1))),
    ).to.deep.equal(READ)
  }

  /**
   * A profile being read constantly must not be the one evicted: writing an
   * entry again moves it to the back of the queue.
   */
  @test()
  aRefreshedEntry_isNotTheOneEvicted() {
    for (let index = 0; index < IdentityReadCache.MAX_ENTRIES; index += 1) {
      const subject = subjectOf(index)

      this.cache.set(subject, refFor(subject), READ)
    }

    const popular = subjectOf(0)

    this.cache.set(popular, refFor(popular), READ)

    const next = subjectOf(IdentityReadCache.MAX_ENTRIES + 1)

    this.cache.set(next, refFor(next), READ)

    expect(this.cache.size).to.equal(IdentityReadCache.MAX_ENTRIES)
    expect(this.cache.get(popular, refFor(popular))).to.deep.equal(READ)
    expect(this.cache.get(subjectOf(1), refFor(subjectOf(1)))).to.equal(null)
  }

  /** A disabled cache stores nothing at all, so it cannot grow either. */
  @test()
  aDisabledCacheStoresNothing() {
    this.cache.ttlMs = 0

    for (let index = 0; index < 100; index += 1) {
      const subject = subjectOf(index)

      this.cache.set(subject, refFor(subject), READ)
    }

    expect(this.cache.size).to.equal(0)
  }
}
