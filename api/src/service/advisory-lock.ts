import * as crypto from 'crypto'
import { injectable } from 'inversify'

import { getDataSource } from '@/connector/data-source'

/**
 * Mutual exclusion between API replicas, on the one thing they all share:
 * the database. A Postgres transaction-level advisory lock costs no table,
 * so it adds nothing to the five domains, and it is released by the
 * database itself when its transaction ends - a replica killed while
 * holding it does not wedge the others.
 */
@injectable()
export class AdvisoryLock {
  /**
   * Runs `work` while holding the named lock, waiting up to `waitMs` for
   * another holder to finish. Past that the database refuses the lock
   * (SQLSTATE 55P03) and the call rejects without running `work`.
   *
   * The lock is held by a transaction that writes nothing, so `work` runs
   * outside it; only the lock's lifetime is tied to it.
   */
  public runSerially<A>(
    name: string,
    waitMs: number,
    work: () => Promise<A>,
  ): Promise<A> {
    const timeout = Math.max(1, Math.floor(waitMs))

    return getDataSource().transaction(async (manager) => {
      // SET cannot take a bound parameter; the value is an integer made here.
      await manager.query(`SET LOCAL lock_timeout = ${timeout}`)
      await manager.query('SELECT pg_advisory_xact_lock($1::bigint)', [
        AdvisoryLock.keyFor(name),
      ])

      return work()
    })
  }

  /** Whether a failure is the lock not being granted in time. */
  public static isTimeout(error: unknown): boolean {
    return (
      (error as { code?: unknown } | null)?.code === '55P03' ||
      (error as { driverError?: { code?: unknown } } | null)?.driverError
        ?.code === '55P03'
    )
  }

  /**
   * A stable signed 64-bit key for a lock name: advisory locks are keyed by
   * number, and the key space is the whole database's, so the name is
   * hashed rather than numbered by hand.
   */
  private static keyFor(name: string): string {
    return crypto
      .createHash('sha256')
      .update(name)
      .digest()
      .readBigInt64BE(0)
      .toString()
  }
}
