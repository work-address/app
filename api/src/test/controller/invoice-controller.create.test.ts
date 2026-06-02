import { expect } from 'chai'
import axios from 'axios'
import faker from 'faker'
import moment from 'moment'
import { suite, test } from '@testdeck/mocha'

import { invoiceControllerCreate } from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { EProjectState } from '@/model/project'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeRepository } from '@/repository/time-repository'

@suite
export class InvoiceControllerCreateTest extends BaseControllerTest {
  protected projectRepository: ProjectRepository
  protected timeRepository: TimeRepository

  constructor() {
    super()
    this.projectRepository = this.container.get('ProjectRepository')
    this.timeRepository = this.container.get('TimeRepository')
  }
  @test()
  async createFromLoggedTime() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    const fromAt = moment.utc().subtract(2, 'hours')
    const toAt = moment.utc().subtract(1, 'hour')
    const time = await this.timeFixture.create(
      project,
      fromAt.toDate(),
      toAt.toDate(),
    )

    const res = await invoiceControllerCreate({
      client: this.apiClient(),
      path: { projectId: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        fromUnix: fromAt.valueOf(),
        toUnix: toAt.valueOf(),
      },
      throwOnError: true,
    })

    const expectedHours = (time.minutesActive || 0) / 60
    const expectedAmount = 60 * expectedHours

    expect(res.status).to.be.equal(200)
    expect(res.data.amount).to.be.equal(expectedAmount)
    expect(res.data.state).to.be.equal('Requested')
    expect(res.data.project?.id).to.be.equal(project.id)
  }

  @test()
  async create_returnsZeroAmountWhenNoTimeInRange() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)

    const res = await invoiceControllerCreate({
      client: this.apiClient(),
      path: { projectId: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        fromUnix: moment.utc().subtract(1, 'day').valueOf(),
        toUnix: moment.utc().subtract(23, 'hours').valueOf(),
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data.amount).to.be.equal(0)
  }

  @test()
  async create_deniedForNonOwner() {
    const owner = await this.userFixture.createUser()
    const other = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    let error: unknown

    try {
      await invoiceControllerCreate({
        client: this.apiClient(),
        path: { projectId: project.id as never },
        headers: {
          Authorization: this.authenticator.getTokens(other).accessToken,
        },
        body: {
          fromUnix: moment.utc().subtract(1, 'day').valueOf(),
          toUnix: moment.utc().valueOf(),
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(401)
    expect(error.response?.data.name).to.be.equal('UserAccessException')
  }

  @test()
  async create_deniedForWorkerWithProjectAccess() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    await this.projectRepository.saveSingle(project)

    let error: unknown

    try {
      await invoiceControllerCreate({
        client: this.apiClient(),
        path: { projectId: project.id as never },
        headers: {
          Authorization: this.authenticator.getTokens(worker).accessToken,
        },
        body: {
          fromUnix: moment.utc().subtract(1, 'day').valueOf(),
          toUnix: moment.utc().valueOf(),
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(401)
    expect(error.response?.data.name).to.be.equal('UserAccessException')
  }

  @test()
  async create_aggregatesWorkerAndOwnerTimeInRange() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    project.workerAddresses = [worker.address]
    await this.projectRepository.saveSingle(project)

    const fromAt = moment.utc().subtract(3, 'hours')
    const toAt = moment.utc().subtract(1, 'hour')

    const ownerTime = await this.timeFixture.create(
      project,
      fromAt.toDate(),
      fromAt.clone().add(1, 'hour').toDate(),
      owner,
    )
    ownerTime.minutesActive = 60
    await this.timeRepository.saveSingle(ownerTime)

    const workerTime = await this.timeFixture.create(
      project,
      fromAt.clone().add(1, 'hour').toDate(),
      toAt.toDate(),
      worker,
    )
    workerTime.minutesActive = 30
    await this.timeRepository.saveSingle(workerTime)

    const res = await invoiceControllerCreate({
      client: this.apiClient(),
      path: { projectId: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        fromUnix: fromAt.valueOf(),
        toUnix: toAt.valueOf(),
      },
      throwOnError: true,
    })

    const expectedHours = (60 + 30) / 60
    expect(res.status).to.be.equal(200)
    expect(res.data.amount).to.be.equal(60 * expectedHours)
  }

  @test()
  async create_unknownProject_notFound() {
    const owner = await this.userFixture.createUser()

    let error: unknown

    try {
      await invoiceControllerCreate({
        client: this.apiClient(),
        path: { projectId: faker.datatype.uuid() as never },
        headers: {
          Authorization: this.authenticator.getTokens(owner).accessToken,
        },
        body: {
          fromUnix: moment.utc().subtract(1, 'day').valueOf(),
          toUnix: moment.utc().valueOf(),
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(404)
  }

  @test()
  async create_requiresAuthorization() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    let error: unknown

    try {
      await invoiceControllerCreate({
        client: this.apiClient(),
        path: { projectId: project.id as never },
        body: {
          fromUnix: moment.utc().subtract(1, 'day').valueOf(),
          toUnix: moment.utc().valueOf(),
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(401)
  }
}
