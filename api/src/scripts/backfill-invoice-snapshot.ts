import { AppConfig } from '@/app/app-config'
import { AppContainer } from '@/app/app-container'
import { DbConnector } from '@/connector/db-connector'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { runPromise } from '@/service/effect-bridge'

/**
 * One-off backfill for the invoice financial snapshot (DEC-04), run by hand.
 *
 * Invoices issued before the snapshot columns existed have them all null. This
 * marks each of them legacy (`snapshotVersion = 0`) and changes nothing else:
 * the rate they were raised at was never recorded, and inventing one from the
 * project's current rate would print a figure nobody agreed to. A legacy
 * invoice keeps its frozen `amountCents`, reports no rate, and has no
 * InvoiceRecord.
 *
 * Not a migration - the schema comes from the entities (`schema:sync`), and
 * this only labels existing rows. Safe to run more than once: a second run
 * finds nothing unmarked and reports 0.
 *
 * Usage (from api/, after `pnpm run schema:sync` has added the columns):
 *   NODE_ENV=<env> pnpm run backfill:invoice-snapshot
 */
export class InvoiceSnapshotBackfill {
  constructor(protected invoiceRepository: InvoiceRepository) {}

  /** Marks what is still unmarked, and returns how many invoices that was. */
  public run(): Promise<number> {
    return runPromise(this.invoiceRepository.markUnsnapshottedAsLegacy())
  }
}

if (require.main === module) {
  ;(async () => {
    const env = AppConfig.getEnv()
    const parameters = AppConfig.readConfig()
    const connection = await new DbConnector(parameters, env).connect()
    const container = AppContainer.build(parameters, env)

    try {
      const marked = await new InvoiceSnapshotBackfill(
        container.get('InvoiceRepository'),
      ).run()

      console.log(
        `[backfill:invoice-snapshot] marked ${marked} pre-snapshot invoice(s) legacy`,
      )
    } finally {
      await connection.destroy()
    }
  })().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
