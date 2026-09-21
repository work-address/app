import { injectable } from 'inversify'

import { IIdentityChainRead, IIdentityPresentationRef } from '@/model/identity'

interface IEntry {
  /** The exact presentation the answer is about. */
  fingerprint: string
  read: IIdentityChainRead
  expiresAt: number
}

/**
 * The chain's answer about one subject's hosted presentation, kept for a few
 * seconds.
 *
 * `GET /user/:address/identity` is anonymous and on a public profile page, and
 * one call costs six RPC requests: eth_chainId, eth_blockNumber, two
 * eth_calls, the finalized block and eth_getLogs over the registry's whole
 * history. A profile that is linked anywhere pays that per visitor, and a
 * public endpoint with a rate limit stops answering long before the profile
 * stops being read.
 *
 * What makes a cache safe here is that the answer is a fact about a block
 * that has already happened, so a stale one is only ever *older* than the
 * truth, never wrong about it - with one exception, which is this instance's
 * own writes. A publish or a removal here invalidates the subject at once, so
 * a holder who publishes never sees their previous version answered back.
 * Someone else's transaction - a `deactivate` sent from the holder's wallet -
 * is not known here, and is answered up to `ttlMs` late; that is the whole
 * cost, and it is why the window is seconds rather than minutes.
 *
 * The key is the subject, and the entry carries the presentation it answered
 * for: a hosted copy replaced by another version is a miss rather than a
 * wrong hit, whatever order the invalidation and the read arrive in.
 *
 * The map is bounded, in both of the ways it can grow. An expired entry used
 * to be dropped only when the *same* subject was read again, so a crawler
 * walking every public profile once left one entry per address it had ever
 * seen, for the life of the process; a sweep now clears everything expired on
 * a fixed cadence. And a burst faster than the sweep is capped: past
 * {@link MAX_ENTRIES} the oldest entries go first, so the map cannot outgrow
 * a known ceiling however hard the endpoint is hit. Both are a cache being a
 * cache - anything dropped is re-read from the chain.
 */
@injectable()
export class IdentityReadCache {
  /** Long enough to absorb a page's readers, short enough to feel live. */
  public static readonly DEFAULT_TTL_MS = 5000

  /**
   * How many subjects the map may hold.
   *
   * Reached only by a burst arriving faster than {@link SWEEP_EVERY} - at a
   * five-second window that is thousands of distinct profiles a second - and
   * it is a ceiling on memory, not a tuning knob. An entry is about two
   * hundred bytes, so this is a few megabytes at worst.
   */
  public static readonly MAX_ENTRIES = 10000

  /**
   * How many writes pass before expired entries are swept.
   *
   * On the write path rather than on a timer: the cache is a plain object
   * owned by the container, and a timer would keep the process alive and
   * would have to be stopped by everything that builds one. Counting writes
   * costs nothing and sweeps exactly when the map is growing.
   */
  public static readonly SWEEP_EVERY = 256

  /** Zero disables the cache entirely; tests set it to read every time. */
  public ttlMs: number = IdentityReadCache.DEFAULT_TTL_MS

  // Insertion-ordered, which is what makes the eviction below the oldest
  // entry rather than an arbitrary one.
  private readonly entries = new Map<string, IEntry>()

  private writesSinceSweep = 0

  public get(
    subject: string,
    ref: IIdentityPresentationRef,
  ): IIdentityChainRead | null {
    if (this.ttlMs <= 0) {
      return null
    }

    const key = IdentityReadCache.keyOf(subject)
    const entry = this.entries.get(key)

    if (!entry) {
      return null
    }

    if (
      entry.expiresAt <= Date.now() ||
      entry.fingerprint !== IdentityReadCache.fingerprintOf(ref)
    ) {
      this.entries.delete(key)

      return null
    }

    return entry.read
  }

  public set(
    subject: string,
    ref: IIdentityPresentationRef,
    read: IIdentityChainRead,
  ): void {
    if (this.ttlMs <= 0) {
      return
    }

    const key = IdentityReadCache.keyOf(subject)

    // Deleted first so a refreshed entry moves to the end of the insertion
    // order; without it the oldest-first eviction would drop an entry that is
    // being read constantly.
    this.entries.delete(key)
    this.entries.set(key, {
      fingerprint: IdentityReadCache.fingerprintOf(ref),
      read,
      // One clock read, so the window is exactly ttlMs however long the six
      // RPC calls above took.
      expiresAt: Date.now() + this.ttlMs,
    })

    this.writesSinceSweep += 1

    if (this.writesSinceSweep >= IdentityReadCache.SWEEP_EVERY) {
      this.sweep()
    }

    this.evictToCap()
  }

  /** How many subjects are held right now. The bound, made observable. */
  public get size(): number {
    return this.entries.size
  }

  /**
   * Drops every entry whose window has closed.
   *
   * Public so a test can run it deliberately; in ordinary use it runs itself
   * from `set`.
   */
  public sweep(now: number = Date.now()): void {
    this.writesSinceSweep = 0

    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key)
      }
    }
  }

  /**
   * Trims the map back to {@link MAX_ENTRIES}, oldest first.
   *
   * The backstop for a burst that outruns the sweep. Dropping the oldest
   * entry costs one re-read; letting the map grow costs the process.
   */
  private evictToCap(): void {
    while (this.entries.size > IdentityReadCache.MAX_ENTRIES) {
      const oldest = this.entries.keys().next()

      if (oldest.done) {
        return
      }

      this.entries.delete(oldest.value)
    }
  }

  /** Called whenever this instance changes what it hosts for a subject. */
  public invalidate(subject: string): void {
    this.entries.delete(IdentityReadCache.keyOf(subject))
  }

  public clear(): void {
    this.entries.clear()
    this.writesSinceSweep = 0
  }

  /** A subject is a DID, whose EVM part carries no case. */
  private static keyOf(subject: string): string {
    return subject.toLowerCase()
  }

  private static fingerprintOf(ref: IIdentityPresentationRef): string {
    return [
      ref.registry.toLowerCase(),
      ref.subject.toLowerCase(),
      ref.version,
      ref.commitment.toLowerCase(),
      ref.schemaId,
    ].join(' ')
  }
}
