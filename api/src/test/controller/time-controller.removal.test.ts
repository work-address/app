import { expect } from 'chai'
import faker from 'faker'
import axios from 'axios'
import { suite, test } from '@testdeck/mocha'
import moment from 'moment'

import {
  projectControllerEdit,
  timeControllerRemoveProcesses,
  timeControllerRemoveScreenshot,
} from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { TimeRepository } from '@/repository/time-repository'
import { EProjectState } from '@/model/project'

@suite()
export class TimeControllerRemovalTest extends BaseControllerTest {
  protected timeRepository: TimeRepository

  constructor() {
    super()

    this.timeRepository = this.container.get('TimeRepository')
  }

  private async createTimeWithMedia() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )

    time.screenshot = faker.datatype.uuid()
    time.processes = [
      {
        name: faker.datatype.uuid(),
        description: faker.datatype.uuid(),
        timeMin: faker.datatype.number(9),
      },
    ]
    await this.timeRepository.saveSingle(time)

    return { owner, time }
  }

  @test()
  async removeScreenshot() {
    const { owner, time } = await this.createTimeWithMedia()

    const client = this.apiClient()
    const res = await timeControllerRemoveScreenshot({
      client,
      path: { id: time.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      throwOnError: true,
    })

    const updated = await this.timeRepository.findOneBy({
      where: { id: time.id },
    })

    expect(res.status).to.be.equal(200)
    this.expectEmptyResponseBody(res.data)
    expect(updated!.screenshot).to.be.null
    expect(updated!.processes).to.be.deep.eq(time.processes)
  }

  @test()
  async removeProcesses() {
    const { owner, time } = await this.createTimeWithMedia()

    const client = this.apiClient()
    const res = await timeControllerRemoveProcesses({
      client,
      path: { id: time.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      throwOnError: true,
    })

    const updated = await this.timeRepository.findOneBy({
      where: { id: time.id },
    })

    expect(res.status).to.be.equal(200)
    this.expectEmptyResponseBody(res.data)
    expect(updated!.processes).to.be.null
    expect(updated!.screenshot).to.be.eq(time.screenshot)
  }

  @test()
  async removeScreenshot_requiresAuthorization() {
    let error: unknown

    try {
      await timeControllerRemoveScreenshot({
        client: this.apiClient(),
        path: { id: faker.datatype.uuid() as never },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(401)
    expect(error.response?.data.name).to.be.equal('AuthenticationException')
  }

  @test()
  async removeProcesses_requiresAuthorization() {
    let error: unknown

    try {
      await timeControllerRemoveProcesses({
        client: this.apiClient(),
        path: { id: faker.datatype.uuid() as never },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(401)
    expect(error.response?.data.name).to.be.equal('AuthenticationException')
  }

  @test()
  async removeScreenshot_deniedForNonOwner() {
    const { time } = await this.createTimeWithMedia()
    const other = await this.userFixture.createUser()

    let error: unknown

    try {
      await timeControllerRemoveScreenshot({
        client: this.apiClient(),
        path: { id: time.id as never },
        headers: {
          Authorization: this.authenticator.getTokens(other).accessToken,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(401)
    expect(error.response?.data.name).to.be.equal('UserAccessException')

    const unchanged = await this.timeRepository.findOneBy({
      where: { id: time.id },
    })
    expect(unchanged!.screenshot).to.be.eq(time.screenshot)
  }

  @test()
  async removeScreenshot_deniedForWorker() {
    const owner = await this.userFixture.createUser()
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

    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )
    time.screenshot = faker.datatype.uuid()
    await this.timeRepository.saveSingle(time)

    let error: unknown

    try {
      await timeControllerRemoveScreenshot({
        client: this.apiClient(),
        path: { id: time.id as never },
        headers: {
          Authorization: this.authenticator.getTokens(worker).accessToken,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(401)

    const unchanged = await this.timeRepository.findOneBy({
      where: { id: time.id },
    })
    expect(unchanged!.screenshot).to.be.eq(time.screenshot)
  }

  @test()
  async removeScreenshot_byWorker() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
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
        viewerAddresses: [],
      },
      throwOnError: true,
    })

    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
      worker,
    )
    time.screenshot = faker.datatype.uuid()
    await this.timeRepository.saveSingle(time)

    const res = await timeControllerRemoveScreenshot({
      client: this.apiClient(),
      path: { id: time.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(worker).accessToken,
      },
      throwOnError: true,
    })

    const updated = await this.timeRepository.findOneBy({
      where: { id: time.id },
    })

    expect(res.status).to.be.equal(200)
    expect(updated!.screenshot).to.be.null
  }

  @test()
  async removeProcesses_deniedForNonOwner() {
    const { time } = await this.createTimeWithMedia()
    const other = await this.userFixture.createUser()

    let error: unknown

    try {
      await timeControllerRemoveProcesses({
        client: this.apiClient(),
        path: { id: time.id as never },
        headers: {
          Authorization: this.authenticator.getTokens(other).accessToken,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(401)
    expect(error.response?.data.name).to.be.equal('UserAccessException')

    const unchanged = await this.timeRepository.findOneBy({
      where: { id: time.id },
    })
    expect(unchanged!.processes).to.be.deep.eq(time.processes)
  }

  @test()
  async removeProcesses_deniedForWorker() {
    const owner = await this.userFixture.createUser()
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

    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )
    time.processes = [
      {
        name: faker.datatype.uuid(),
        description: faker.datatype.uuid(),
        timeMin: faker.datatype.number(9),
      },
    ]
    await this.timeRepository.saveSingle(time)

    let error: unknown

    try {
      await timeControllerRemoveProcesses({
        client: this.apiClient(),
        path: { id: time.id as never },
        headers: {
          Authorization: this.authenticator.getTokens(worker).accessToken,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(401)

    const unchanged = await this.timeRepository.findOneBy({
      where: { id: time.id },
    })
    expect(unchanged!.processes).to.be.deep.eq(time.processes)
  }

  @test()
  async removeProcesses_byWorker() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
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
        viewerAddresses: [],
      },
      throwOnError: true,
    })

    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
      worker,
    )
    time.processes = [
      {
        name: faker.datatype.uuid(),
        description: faker.datatype.uuid(),
        timeMin: faker.datatype.number(9),
      },
    ]
    await this.timeRepository.saveSingle(time)

    const res = await timeControllerRemoveProcesses({
      client: this.apiClient(),
      path: { id: time.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(worker).accessToken,
      },
      throwOnError: true,
    })

    const updated = await this.timeRepository.findOneBy({
      where: { id: time.id },
    })

    expect(res.status).to.be.equal(200)
    expect(updated!.processes).to.be.null
  }

  @test()
  async removeScreenshot_unknownTime_notFound() {
    const owner = await this.userFixture.createUser()

    let error: unknown

    try {
      await timeControllerRemoveScreenshot({
        client: this.apiClient(),
        path: { id: faker.datatype.uuid() as never },
        headers: {
          Authorization: this.authenticator.getTokens(owner).accessToken,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(404)
    expect(error.response?.data.name).to.be.equal('NotFoundError')
    expect(error.response?.data.message).to.be.equal('Time does not exist')
  }

  @test()
  async removeProcesses_unknownTime_notFound() {
    const owner = await this.userFixture.createUser()

    let error: unknown

    try {
      await timeControllerRemoveProcesses({
        client: this.apiClient(),
        path: { id: faker.datatype.uuid() as never },
        headers: {
          Authorization: this.authenticator.getTokens(owner).accessToken,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(404)
    expect(error.response?.data.name).to.be.equal('NotFoundError')
    expect(error.response?.data.message).to.be.equal('Time does not exist')
  }
}
