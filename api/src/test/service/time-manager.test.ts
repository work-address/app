import { expect } from 'chai'
import moment from 'moment'
import { suite, test } from '@testdeck/mocha'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { TimeManager } from '@/service/time-manager'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeFixture } from '@/test/fixture/time-fixture'
import { TimeRepository } from '@/repository/time-repository'
import AccessException from '@/exception/access-exception'
import { EProjectState } from '@/model/project'
import { TimeCreateDto } from '@/model/dto/time'

@suite()
export class TimeManagerTest extends AbstractDatabaseIntegration {
  protected timeManager: TimeManager
  protected projectFixture: ProjectFixture
  protected projectRepository: ProjectRepository
  protected timeFixture: TimeFixture
  protected timeRepository: TimeRepository

  constructor() {
    super()
    this.timeManager = this.container.get('TimeManager')
    this.projectFixture = this.container.get('ProjectFixture')
    this.projectRepository = this.container.get('ProjectRepository')
    this.timeFixture = this.container.get('TimeFixture')
    this.timeRepository = this.container.get('TimeRepository')
  }

  private buildTimePayload(
    projectId: string,
    userSuffix: number,
  ): TimeCreateDto {
    const fromAt = moment.utc().subtract(10, 'minutes')
    const toAt = moment.utc()

    return {
      fromIndex: userSuffix,
      toIndex: userSuffix + 1,
      note: `entry-${userSuffix}`,
      keyboardKeys: 1,
      minutesActive: 10,
      mouseKeys: 1,
      mouseDistance: 1,
      fromAt: fromAt.toISOString(),
      toAt: toAt.toISOString(),
      projectId,
    }
  }

  @test()
  async createOrUpdateMany_savesTimeForWorkerOnActiveProject() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    await this.projectRepository.saveSingle(project)

    const [result] = await this.timeManager.createOrUpdateMany(
      [this.buildTimePayload(project.id, 1)],
      worker,
    )

    expect(result.error).to.be.undefined
    expect(result.id).to.be.a('string')
  }

  @test()
  async createOrUpdateMany_returnsErrorForViewerOnSharedProject() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    project.viewerAddresses = [viewer.address]
    await this.projectRepository.saveSingle(project)

    const [result] = await this.timeManager.createOrUpdateMany(
      [this.buildTimePayload(project.id, 2)],
      viewer,
    )

    expect(result.error).to.exist
    expect(result.error?.name).to.be.equal('EntityNotFoundError')
    expect(result.id).to.be.undefined
  }

  @test()
  async createOrUpdateMany_returnsErrorWhenProjectInactive() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.INACTIVE,
    )
    project.workerAddresses = [worker.address]
    await this.projectRepository.saveSingle(project)

    const [result] = await this.timeManager.createOrUpdateMany(
      [this.buildTimePayload(project.id, 3)],
      worker,
    )

    expect(result.error).to.exist
    expect(result.error?.name).to.be.equal('EntityNotFoundError')
  }

  @test()
  async createOrUpdateMany_returnsErrorWhenUpdatingAnotherUsersEntry() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const otherWorker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address, otherWorker.address]
    await this.projectRepository.saveSingle(project)

    const payload = this.buildTimePayload(project.id, 4)
    const [saved] = await this.timeManager.createOrUpdateMany([payload], worker)
    expect(saved.id).to.be.a('string')

    const [result] = await this.timeManager.createOrUpdateMany(
      [{ ...payload, note: 'stolen update' }],
      otherWorker,
    )

    expect(result.error).to.exist
    expect(result.error?.name).to.be.equal('UserAccessException')
  }

  @test()
  async setIsPaidMany_allowsAuthorToMarkOwnEntries() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
      owner,
    )

    await this.timeManager.setIsPaidMany([time.id], true, owner)

    const updated = await this.timeRepository.findOneBy({
      where: { id: time.id },
    })
    expect(updated!.isPaid).to.be.true
  }

  @test()
  async setIsPaidMany_deniesNonAuthorEvenWhenProjectOwner() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    await this.projectRepository.saveSingle(project)

    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
      worker,
    )

    let error: unknown

    try {
      await this.timeManager.setIsPaidMany([time.id], true, owner)
    } catch (e: unknown) {
      error = e
    }

    expect(error).to.be.instanceOf(AccessException)
  }
}
