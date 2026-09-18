import { DataSource, EntityTarget, ObjectLiteral } from 'typeorm'

/**
 * Makes every UPDATE of one table fail, for as long as a callback runs.
 *
 * A database trigger rather than a stubbed repository method: the failure
 * then happens where a real one would - in Postgres, partway through the
 * service's own writes - so a test proves the transaction, not the stub.
 * The test schema is dropped between tests, but the trigger is removed as soon
 * as the callback settles anyway, so nothing after it is affected.
 */
export class ForcedWriteFailure {
  public static readonly MESSAGE = 'forced write failure'

  private static readonly NAME = 'test_forced_write_failure'

  constructor(private readonly source: DataSource) {}

  public async duringUpdatesOf<T>(
    target: EntityTarget<ObjectLiteral>,
    body: () => Promise<T>,
  ): Promise<T> {
    const table = this.source.getMetadata(target).tableName
    const name = ForcedWriteFailure.NAME

    await this.source.query(
      `CREATE OR REPLACE FUNCTION ${name}() RETURNS trigger AS $$
       BEGIN
         RAISE EXCEPTION '${ForcedWriteFailure.MESSAGE}';
       END;
       $$ LANGUAGE plpgsql`,
    )
    await this.source.query(
      `CREATE TRIGGER ${name} BEFORE UPDATE ON "${table}"
       FOR EACH ROW EXECUTE FUNCTION ${name}()`,
    )

    try {
      return await body()
    } finally {
      await this.source.query(`DROP TRIGGER IF EXISTS ${name} ON "${table}"`)
    }
  }
}
