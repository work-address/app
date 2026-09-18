import { DataSource } from 'typeorm'

/**
 * Starts several calls at the same moment, so a race between them is
 * actually run rather than merely possible.
 *
 * The pool opens a connection per waiting query, which takes a few
 * milliseconds; left cold, the first call gets the one open connection and
 * can finish before the others have connected, so they never overlap. Opening
 * a connection per call first puts every call on the database at once.
 */
export class ConcurrentCalls {
  constructor(private readonly source: DataSource) {}

  public async settle<T>(
    calls: (() => Promise<T>)[],
  ): Promise<PromiseSettledResult<T>[]> {
    await Promise.all(calls.map(() => this.source.query('SELECT 1')))

    return Promise.allSettled(calls.map((call) => call()))
  }
}
