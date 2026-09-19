import { Effect } from 'effect'

import { AppConfig } from '@/app/app-config'
import { AppContainer } from '@/app/app-container'
import { DbConnector } from '@/connector/db-connector'
import { ITimeAuthorKeyAudit, ITimeSliceGroup } from '@/model/time'
import { TimeRepository } from '@/repository/time-repository'
import { runPromise } from '@/service/effect-bridge'

/**
 * Hand-run audit for the Time unique key moving from (project, fromAt) to
 * (project, user, fromAt) - G2, where a second person tracking the same
 * project at the same time had their slice refused.
 *
 * Not a migration: the schema comes from the entities, and `schema:sync`
 * swaps the constraint. Swapping it keeps every row - the new key is the old
 * one plus a column, so rows unique under the old key are unique under the
 * new one. This reports the rows the new key would treat differently, so
 * whoever runs the sync knows before they do:
 *
 * - one author with more than one row for a slice. Only possible where the
 *   old key was never enforced; `schema:sync` cannot add the new key until
 *   each is resolved by hand, so the script exits 1.
 * - a slice held by several authors. Refused by the old key, separate
 *   entries under the new one, each counted in totals.
 *
 * It reads and never writes: nothing is deleted, merged or moved.
 *
 * Usage (from api/, before and again after `pnpm run schema:sync`):
 *   NODE_ENV=<env> pnpm run audit:time-author-key
 */
export class TimeAuthorKeyAudit {
  public static readonly OLD_KEY = 'UQ_PROJECT_FROM_AT'
  public static readonly NEW_KEY = 'UQ_TIME_PROJECT_USER_FROM_AT'

  constructor(protected timeRepository: TimeRepository) {}

  public run(): Promise<ITimeAuthorKeyAudit> {
    return runPromise(
      Effect.all({
        uniqueConstraints: this.timeRepository.findUniqueConstraintNames(),
        duplicateAuthorSlices: this.timeRepository.findDuplicateAuthorSlices(),
        sharedSlices: this.timeRepository.findSlicesSharedByAuthors(),
      }),
    )
  }

  /** The report as lines for a person to read. */
  public static describe(audit: ITimeAuthorKeyAudit): string[] {
    const slice = (group: ITimeSliceGroup): string =>
      `  project ${group.projectId} fromAt ${group.fromAt.toISOString()} authors ${group.userIds.join(',')} rows ${group.timeIds.join(',')}`
    const has = (name: string) => audit.uniqueConstraints.includes(name)

    return [
      `old key ${TimeAuthorKeyAudit.OLD_KEY}: ${has(TimeAuthorKeyAudit.OLD_KEY) ? 'present' : 'absent'}`,
      `new key ${TimeAuthorKeyAudit.NEW_KEY}: ${has(TimeAuthorKeyAudit.NEW_KEY) ? 'present' : 'absent'}`,
      `${audit.duplicateAuthorSlices.length} slice(s) where one author has several rows - the new key cannot be added until each is resolved by hand`,
      ...audit.duplicateAuthorSlices.map(slice),
      `${audit.sharedSlices.length} slice(s) held by several authors - refused by the old key, separate entries under the new one`,
      ...audit.sharedSlices.map(slice),
      'nothing was changed',
    ]
  }
}

if (require.main === module) {
  ;(async () => {
    const env = AppConfig.getEnv()
    const parameters = AppConfig.readConfig()
    const connection = await new DbConnector(parameters, env).connect()
    const container = AppContainer.build(parameters, env)

    try {
      const audit = await new TimeAuthorKeyAudit(
        container.get('TimeRepository'),
      ).run()

      for (const line of TimeAuthorKeyAudit.describe(audit)) {
        console.log(`[audit:time-author-key] ${line}`)
      }

      if (audit.duplicateAuthorSlices.length > 0) {
        process.exitCode = 1
      }
    } finally {
      await connection.destroy()
    }
  })().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
