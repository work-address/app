import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import moment from 'moment'

import AccessException from '@/exception/access-exception'
import { Time } from '@/entity/time'
import { EProjectState } from '@/model/project'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeRepository } from '@/repository/time-repository'
import { runPromise } from '@/service/effect-bridge'
import { TimeManager } from '@/service/time-manager'
import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { TimeFixture } from '@/test/fixture/time-fixture'
import { UserFixture } from '@/test/fixture/user-fixture'

/** What an author may change on an entry after it is recorded. */
@suite()
export class TimeAuthorChangesTest extends AbstractDatabaseIntegration {
  protected userFixture: UserFixture
  protected projectFixture: ProjectFixture
  protected timeFixture: TimeFixture
  protected timeManager: TimeManager
  protected timeRepository: TimeRepository
  protected projectRepository: ProjectRepository

  constructor() {
    super()

    this.userFixture = this.container.get('UserFixture')
    this.projectFixture = this.container.get('ProjectFixture')
    this.timeFixture = this.container.get('TimeFixture')
    this.timeManager = this.container.get('TimeManager')
    this.timeRepository = this.container.get('TimeRepository')
    this.projectRepository = this.container.get('ProjectRepository')
  }

  private async scenario() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    project.rateHour = 60
    await runPromise(this.projectRepository.saveSingle(project))

    const entry = (minutesAgo: number, author = worker) =>
      this.timeFixture.create(
        project,
        moment.utc().subtract(minutesAgo, 'minutes').toDate(),
        moment
          .utc()
          .subtract(minutesAgo - 10, 'minutes')
          .toDate(),
        author,
      )

    return { owner, worker, project, entry }
  }

  private read(id: string) {
    return runPromise(this.timeRepository.findOneBy({ where: { id } }))
  }

  private async refusal(run: () => Promise<unknown>): Promise<unknown> {
    try {
      await run()
    } catch (error: unknown) {
      return error
    }
    throw new Error('Expected the change to be refused')
  }

  @test()
  async aBatchWithSomeoneElsesEntryChangesNothing() {
    const { owner, worker, entry } = await this.scenario()
    const mine = await entry(120)
    const theirs = await entry(100, owner)

    const error = await this.refusal(() =>
      runPromise(
        this.timeManager.setIsPaidMany([mine.id, theirs.id], true, worker),
      ),
    )
    expect(error).to.be.instanceOf(AccessException)
    expect((await this.read(mine.id))!.isPaid).to.not.equal(true)

    expect(
      await this.refusal(() =>
        runPromise(this.timeManager.removeMany([mine.id, theirs.id], worker)),
      ),
    ).to.be.instanceOf(AccessException)
    expect(await this.read(mine.id)).to.exist
  }

  @test()
  async onlyItsAuthorCanEditAnEntry() {
    const { owner, entry } = await this.scenario()
    const time = await entry(120)

    expect(
      await this.refusal(() =>
        runPromise(
          this.timeManager.edit(
            time.id,
            Object.assign(new Time(), { note: 'rewritten' }),
            owner,
          ),
        ),
      ),
    ).to.be.instanceOf(AccessException)
    expect((await this.read(time.id))!.note).to.equal(time.note)
  }

  /** A loaded copy going stale can't matter: only the named column is written. */
  @test()
  async aChangeTouchesOnlyItsOwnColumns() {
    const { worker, entry } = await this.scenario()
    const time = await entry(120)
    const before = await this.read(time.id)

    await runPromise(this.timeManager.setIsPaidMany([time.id], true, worker))
    await runPromise(
      this.timeManager.edit(
        time.id,
        Object.assign(new Time(), { note: 'changed' }),
        worker,
      ),
    )

    const after = await this.read(time.id)
    expect(after!.isPaid).to.equal(true)
    expect(after!.note).to.equal('changed')
    expect(after!.minutesActive).to.equal(before!.minutesActive)
    expect(after!.keyboardKeys).to.equal(before!.keyboardKeys)
    expect(after!.mouseKeys).to.equal(before!.mouseKeys)
  }
}
