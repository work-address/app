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
 */
@injectable()
export class IdentityReadCache {
  /** Long enough to absorb a page's readers, short enough to feel live. */
  public static readonly DEFAULT_TTL_MS = 5000

  /** Zero disables the cache entirely; tests set it to read every time. */
  public ttlMs: number = IdentityReadCache.DEFAULT_TTL_MS

  private readonly entries = new Map<string, IEntry>()

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

    this.entries.set(IdentityReadCache.keyOf(subject), {
      fingerprint: IdentityReadCache.fingerprintOf(ref),
      read,
      // One clock read, so the window is exactly ttlMs however long the six
      // RPC calls above took.
      expiresAt: Date.now() + this.ttlMs,
    })
  }

  /** Called whenever this instance changes what it hosts for a subject. */
  public invalidate(subject: string): void {
    this.entries.delete(IdentityReadCache.keyOf(subject))
  }

  public clear(): void {
    this.entries.clear()
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
