import faker from 'faker'
import moment from 'moment'
import { expect } from 'chai'
import axios from 'axios'
import { suite, test } from '@testdeck/mocha'

import { projectControllerEdit, projectControllerGetStats } from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { ProjectStatisticsRepository } from '@/repository/project-statistics-repository'
import { TimeRepository } from '@/repository/time-repository'
import { EProjectState } from '@/model/project'
import { EProjectStatisticsPeriod } from '@/model/project-statistics'
import { User } from '@/entity/user'
import { Project } from '@/entity/project'

@suite
export class ProjectControllerStatsTest extends BaseControllerTest {
  protected projectStatisticsRepository: ProjectStatisticsRepository
  protected timeRepository: TimeRepository

  constructor() {
    super()

    this.projectStatisticsRepository = this.container.get(
      'ProjectStatisticsRepository',
    )
    this.timeRepository = this.container.get('TimeRepository')
  }

  @test
  async getStatsAsOwner_aggregatesProcessTime() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    await this.createTimeWithProcesses(project, [
      { name: 'code', timeMin: 10 },
      { name: 'chrome', timeMin: 5 },
    ])
    await this.createTimeWithProcesses(
      project,
      [{ name: 'code', timeMin: 15 }],
      20,
    )

    const res = await this.getStats(
      project,
      owner,
      EProjectStatisticsPeriod.ONE_DAY,
    )

    expect(res.status).to.be.equal(200)
    expect(res.data).to.have.length(2)

    const code = res.data!.find((row) => row.processName === 'code')
    const chrome = res.data!.find((row) => row.processName === 'chrome')

    expect(code?.timeMin).to.be.equal(25)
    expect(code?.period).to.be.equal(EProjectStatisticsPeriod.ONE_DAY)
    expect(chrome?.timeMin).to.be.equal(5)
    expect(chrome?.period).to.be.equal(EProjectStatisticsPeriod.ONE_DAY)

    const stored =
      await this.projectStatisticsRepository.findAllForProjectAndPeriod(
        project,
        EProjectStatisticsPeriod.ONE_DAY,
      )

    expect(stored).to.have.length(2)
    expect(
      stored.find((row) => row.processName === 'code')?.timeMin,
    ).to.be.equal(25)
  }

  @test
  async getStats_returnsEmptyWhenNoProcessData() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    await this.timeFixture.create(
      project,
      moment().subtract(30, 'minutes').toDate(),
      moment().subtract(20, 'minutes').toDate(),
    )

    const res = await this.getStats(
      project,
      owner,
      EProjectStatisticsPeriod.ONE_DAY,
    )

    expect(res.status).to.be.equal(200)
    expect(res.data).to.deep.equal([])
  }

  @test
  async getStats_returnsCachedStatsOnSecondCall() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    await this.createTimeWithProcesses(project, [
      { name: 'slack', timeMin: 12 },
    ])

    const first = await this.getStats(
      project,
      owner,
      EProjectStatisticsPeriod.ONE_DAY,
    )
    const storedAfterFirst =
      await this.projectStatisticsRepository.findAllForProjectAndPeriod(
        project,
        EProjectStatisticsPeriod.ONE_DAY,
      )
    const updatedAtAfterFirst = storedAfterFirst[0].updatedAt

    const second = await this.getStats(
      project,
      owner,
      EProjectStatisticsPeriod.ONE_DAY,
    )

    expect(first.data).to.deep.equal(second.data)

    const storedAfterSecond =
      await this.projectStatisticsRepository.findAllForProjectAndPeriod(
        project,
        EProjectStatisticsPeriod.ONE_DAY,
      )

    expect(storedAfterSecond).to.have.length(1)
    expect(storedAfterSecond[0].updatedAt).to.deep.equal(updatedAtAfterFirst)
  }

  @test
  async getStatsAsWorker() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    await projectControllerEdit({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        title: project.title,
        text: project.text,
        state: project.state,
        workerAddresses: [worker.address],
        viewerAddresses: [viewer.address],
      },
      throwOnError: true,
    })

    const res = await this.getStats(
      project,
      worker,
      EProjectStatisticsPeriod.ONE_DAY,
    )

    expect(res.status).to.be.equal(200)
    expect(res.data).to.be.an('array')
  }

  @test
  async getStatsAsViewer() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    await projectControllerEdit({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        title: project.title,
        text: project.text,
        state: project.state,
        workerAddresses: [worker.address],
        viewerAddresses: [viewer.address],
      },
      throwOnError: true,
    })

    const res = await this.getStats(
      project,
      viewer,
      EProjectStatisticsPeriod.ONE_DAY,
    )

    expect(res.status).to.be.equal(200)
    expect(res.data).to.be.an('array')
  }

  @test
  async getStatsAsNonOwner() {
    const owner = await this.userFixture.createPremiumUser()
    const other = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    let error: unknown

    try {
      await projectControllerGetStats({
        client: this.apiClient(),
        path: {
          id: project.id as never,
          period: EProjectStatisticsPeriod.ONE_DAY as never,
        },
        headers: {
          Authorization: this.authenticator.getTokens(other).accessToken,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(403)
    expect(error.response?.data.name).to.be.equal('UserAccessException')
  }

  @test
  async getStats_unknownProject_notFound() {
    const owner = await this.userFixture.createPremiumUser()

    let error: unknown

    try {
      await projectControllerGetStats({
        client: this.apiClient(),
        path: {
          id: faker.datatype.uuid() as never,
          period: EProjectStatisticsPeriod.ONE_DAY as never,
        },
        headers: {
          Authorization: this.authenticator.getTokens(owner).accessToken,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(404)
  }

  @test
  async getStats_requiresAuthorization() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    let error: unknown

    try {
      await projectControllerGetStats({
        client: this.apiClient(),
        path: {
          id: project.id as never,
          period: EProjectStatisticsPeriod.ONE_DAY as never,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(401)
  }

  @test
  async getStats_invalidPeriod() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    let error: unknown

    try {
      await projectControllerGetStats({
        client: this.apiClient(),
        path: {
          id: project.id as never,
          period: 'INVALID' as never,
        },
        headers: {
          Authorization: this.authenticator.getTokens(owner).accessToken,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(400)
    expect(error.response?.data.name).to.be.equal('BadRequestError')
  }

  private getStats(
    project: Project,
    user: User,
    period: EProjectStatisticsPeriod,
  ) {
    return projectControllerGetStats({
      client: this.apiClient(),
      path: {
        id: project.id as never,
        period: period as never,
      },
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      throwOnError: true,
    })
  }

  private async createTimeWithProcesses(
    project: Project,
    processes: { name: string; timeMin: number }[],
    minutesAgo = 30,
  ) {
    const fromAt = moment().subtract(minutesAgo, 'minutes').toDate()
    const toAt = moment()
      .subtract(Math.max(minutesAgo - 10, 0), 'minutes')
      .toDate()
    const time = await this.timeFixture.create(project, fromAt, toAt)

    time.processes = processes

    return this.timeRepository.saveSingle(time)
  }
}
