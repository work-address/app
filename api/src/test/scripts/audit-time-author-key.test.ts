import { expect } from 'chai'
import moment from 'moment'
import { suite, test } from '@testdeck/mocha'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { TimeAuthorKeyAudit } from '@/scripts/audit-time-author-key'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { TimeFixture } from '@/test/fixture/time-fixture'
import { TimeRepository } from '@/repository/time-repository'
import { Time } from '@/entity/time'
import { ITimeSliceGroup } from '@/model/time'
import { runPromise } from '@/service/effect-bridge'

/**
 * The audit that stands in for a migration when the Time key gains its
 * author: it names the rows the new key treats differently and changes none
 * of them.
 */
@suite()
export class AuditTimeAuthorKeyTest extends AbstractDatabaseIntegration {
  protected projectFixture: ProjectFixture
  protected timeFixture: TimeFixture
  protected timeRepository: TimeRepository

  constructor() {
    super()

    this.projectFixture = this.container.get('ProjectFixture')
    this.timeFixture = this.container.get('TimeFixture')
    this.timeRepository = this.container.get('TimeRepository')
  }

  /**
   * The groups for one project, with row ids sorted: rows written in one
   * transaction share `createdAt`, so "oldest first" ties there.
   */
  private static forProject(
    groups: ITimeSliceGroup[],
    projectId: string,
  ): ITimeSliceGroup[] {
    return groups
      .filter((group) => group.projectId === projectId)
      .map((group) => ({ ...group, timeIds: [...group.timeIds].sort() }))
  }

  /**
   * On the new key a slice may hold one row per author. The audit reports
   * such a slice - the old key refused it - and leaves every row in place.
   */
  @test()
  async run_reportsSlicesSharedByAuthors_andDeletesNothing() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner)
    const now = moment.utc()
    const fromAt = now.clone().subtract(10, 'minutes').toDate()
    const toAt = now.toDate()

    const ownersRow = await this.timeFixture.create(
      project,
      fromAt,
      toAt,
      owner,
    )
    const workersRow = await this.timeFixture.create(
      project,
      fromAt,
      toAt,
      worker,
    )
    const alone = await this.timeFixture.create(
      project,
      now.clone().subtract(30, 'minutes').toDate(),
      now.clone().subtract(20, 'minutes').toDate(),
      owner,
    )
    // A soft-deleted row still holds its slice for the constraint, so it
    // still counts.
    await runPromise(this.timeRepository.softDelete({ id: alone.id }))

    const before = await this.conn
      .getRepository(Time)
      .count({ withDeleted: true })

    const audit = await new TimeAuthorKeyAudit(this.timeRepository).run()

    expect(audit.uniqueConstraints).to.include(TimeAuthorKeyAudit.NEW_KEY)
    expect(audit.uniqueConstraints).to.not.include(TimeAuthorKeyAudit.OLD_KEY)
    expect(
      AuditTimeAuthorKeyTest.forProject(
        audit.duplicateAuthorSlices,
        project.id,
      ),
    ).to.deep.equal([])
    expect(
      AuditTimeAuthorKeyTest.forProject(audit.sharedSlices, project.id),
    ).to.deep.equal([
      {
        projectId: project.id,
        fromAt,
        userIds: [owner.id, worker.id].sort(),
        timeIds: [ownersRow.id, workersRow.id].sort(),
      },
    ])

    expect(
      await this.conn.getRepository(Time).count({ withDeleted: true }),
    ).to.equal(before)

    const lines = TimeAuthorKeyAudit.describe(audit)

    expect(lines[0]).to.equal(`old key ${TimeAuthorKeyAudit.OLD_KEY}: absent`)
    expect(lines[1]).to.equal(`new key ${TimeAuthorKeyAudit.NEW_KEY}: present`)
    expect(lines.join('\n')).to.contain(
      `  project ${project.id} fromAt ${fromAt.toISOString()} authors ${[owner.id, worker.id].sort().join(',')} rows `,
    )
    expect(lines.slice(-1)).to.deep.equal(['nothing was changed'])
  }

  /**
   * On a database where no key was ever enforced, one author can have two
   * rows for a slice - which would stop `schema:sync` adding the new key.
   * The audit names them and removes neither. Run inside a transaction that
   * is rolled back, so dropping the constraint touches no other test.
   */
  @test()
  async run_reportsAuthorsWithSeveralRowsForASlice_andDeletesNothing() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner)
    const now = moment.utc()
    const fromAt = now.clone().subtract(10, 'minutes').toDate()
    const toAt = now.toDate()
    const runner = this.conn.createQueryRunner()

    await runner.connect()
    await runner.startTransaction()

    try {
      const table = this.conn.getMetadata(Time).tableName
      const repository = this.timeRepository.within(runner.manager)

      await runner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "${TimeAuthorKeyAudit.NEW_KEY}"`,
      )

      const rows: Time[] = []

      for (const note of ['first', 'second']) {
        const time = new Time()

        time.project = project
        time.user = owner
        time.note = note
        time.keyboardKeys = 1
        time.mouseKeys = 1
        time.mouseDistance = 1
        time.minutesActive = 5
        time.fromAt = fromAt
        time.toAt = toAt
        rows.push(await runPromise(repository.saveSingle(time)))
      }

      const audit = await new TimeAuthorKeyAudit(repository).run()

      expect(audit.uniqueConstraints).to.not.include(TimeAuthorKeyAudit.NEW_KEY)
      expect(
        AuditTimeAuthorKeyTest.forProject(
          audit.duplicateAuthorSlices,
          project.id,
        ),
      ).to.deep.equal([
        {
          projectId: project.id,
          fromAt,
          userIds: [owner.id],
          timeIds: rows.map((row) => row.id).sort(),
        },
      ])
      expect(
        AuditTimeAuthorKeyTest.forProject(audit.sharedSlices, project.id),
      ).to.deep.equal([])
      expect(
        await runner.manager
          .getRepository(Time)
          .count({ where: { project: { id: project.id } } }),
      ).to.equal(2)
      expect(TimeAuthorKeyAudit.describe(audit)[2]).to.match(/^1 slice\(s\)/)
    } finally {
      await runner.rollbackTransaction()
      await runner.release()
    }
  }
}
