import { expect } from 'chai'
import { faker } from '@faker-js/faker'
import axios from 'axios'
import { suite, test } from '@testdeck/mocha'
import moment from 'moment'

import {
  projectControllerEdit,
  timeControllerRemoveProcesses,
  timeControllerRemoveScreenshots,
} from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { TimeRepository } from '@/repository/time-repository'
import { EProjectState } from '@/model/project'
import { runPromise } from '@/service/effect-bridge'

@suite()
export class TimeControllerRemovalTest extends BaseControllerTest {
  protected timeRepository: TimeRepository

  constructor() {
    super()

    this.timeRepository = this.container.get('TimeRepository')
  }

  private async createTimeWithMedia() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )

    time.screenshot = faker.string.uuid()
    time.processes = [
      {
        name: faker.string.uuid(),
        description: faker.string.uuid(),
        timeMin: faker.number.int(9),
      },
    ]
    await runPromise(this.timeRepository.saveSingle(time))

    return { owner, project, time }
  }

  @test()
  async removeScreenshots() {
    const { owner, project, time } = await this.createTimeWithMedia()
    const second = await this.timeFixture.create(
      project,
      moment.utc().subtract(120, 'minutes').toDate(),
      moment.utc().subtract(90, 'minutes').toDate(),
    )
    second.screenshot = faker.string.uuid()
    await runPromise(this.timeRepository.saveSingle(second))

    const client = this.apiClient()
    const res = await timeControllerRemoveScreenshots({
      client,
      body: { ids: [time.id, second.id] },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      throwOnError: true,
    })

    const updated = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: time.id },
      }),
    )
    const updatedSecond = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: second.id },
      }),
    )

    expect(res.status).to.be.equal(200)
    this.expectEmptyResponseBody(res.data)
    expect(updated!.screenshot).to.be.null
    expect(updatedSecond!.screenshot).to.be.null
    expect(updated!.processes).to.be.deep.eq(time.processes)
  }

  @test()
  async removeProcesses() {
    const { owner, project, time } = await this.createTimeWithMedia()
    const second = await this.timeFixture.create(
      project,
      moment.utc().subtract(180, 'minutes').toDate(),
      moment.utc().subtract(150, 'minutes').toDate(),
    )
    second.processes = [
      {
        name: faker.string.uuid(),
        description: faker.string.uuid(),
        timeMin: faker.number.int(9),
      },
    ]
    await runPromise(this.timeRepository.saveSingle(second))

    const client = this.apiClient()
    const res = await timeControllerRemoveProcesses({
      client,
      body: { ids: [time.id, second.id] },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      throwOnError: true,
    })

    const updated = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: time.id },
      }),
    )
    const updatedSecond = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: second.id },
      }),
    )

    expect(res.status).to.be.equal(200)
    this.expectEmptyResponseBody(res.data)
    expect(updated!.processes).to.be.null
    expect(updatedSecond!.processes).to.be.null
    expect(updated!.screenshot).to.be.eq(time.screenshot)
  }

  @test()
  async removeScreenshots_requiresAuthorization() {
    let error: unknown

    try {
      await timeControllerRemoveScreenshots({
        client: this.apiClient(),
        body: { ids: [faker.string.uuid()] },
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
        body: { ids: [faker.string.uuid()] },
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
  async removeScreenshots_deniedForNonOwner() {
    const { time } = await this.createTimeWithMedia()
    const other = await this.userFixture.createUser()

    let error: unknown

    try {
      await timeControllerRemoveScreenshots({
        client: this.apiClient(),
        body: { ids: [time.id] },
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
    expect(error.response?.status).to.be.equal(403)
    expect(error.response?.data.name).to.be.equal('UserAccessException')

    const unchanged = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: time.id },
      }),
    )
    expect(unchanged!.screenshot).to.be.eq(time.screenshot)
  }

  @test()
  async removeScreenshots_deniedForWorker() {
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

    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )
    time.screenshot = faker.string.uuid()
    await runPromise(this.timeRepository.saveSingle(time))

    let error: unknown

    try {
      await timeControllerRemoveScreenshots({
        client: this.apiClient(),
        body: { ids: [time.id] },
        headers: {
          Authorization: this.authenticator.getTokens(worker).accessToken,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(403)

    const unchanged = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: time.id },
      }),
    )
    expect(unchanged!.screenshot).to.be.eq(time.screenshot)
  }

  @test()
  async removeScreenshots_byWorker() {
    const owner = await this.userFixture.createPremiumUser()
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
    time.screenshot = faker.string.uuid()
    await runPromise(this.timeRepository.saveSingle(time))

    const res = await timeControllerRemoveScreenshots({
      client: this.apiClient(),
      body: { ids: [time.id] },
      headers: {
        Authorization: this.authenticator.getTokens(worker).accessToken,
      },
      throwOnError: true,
    })

    const updated = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: time.id },
      }),
    )

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
        body: { ids: [time.id] },
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
    expect(error.response?.status).to.be.equal(403)
    expect(error.response?.data.name).to.be.equal('UserAccessException')

    const unchanged = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: time.id },
      }),
    )
    expect(unchanged!.processes).to.be.deep.eq(time.processes)
  }

  @test()
  async removeProcesses_deniedForWorker() {
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

    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )
    time.processes = [
      {
        name: faker.string.uuid(),
        description: faker.string.uuid(),
        timeMin: faker.number.int(9),
      },
    ]
    await runPromise(this.timeRepository.saveSingle(time))

    let error: unknown

    try {
      await timeControllerRemoveProcesses({
        client: this.apiClient(),
        body: { ids: [time.id] },
        headers: {
          Authorization: this.authenticator.getTokens(worker).accessToken,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(403)

    const unchanged = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: time.id },
      }),
    )
    expect(unchanged!.processes).to.be.deep.eq(time.processes)
  }

  @test()
  async removeProcesses_byWorker() {
    const owner = await this.userFixture.createPremiumUser()
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
        name: faker.string.uuid(),
        description: faker.string.uuid(),
        timeMin: faker.number.int(9),
      },
    ]
    await runPromise(this.timeRepository.saveSingle(time))

    const res = await timeControllerRemoveProcesses({
      client: this.apiClient(),
      body: { ids: [time.id] },
      headers: {
        Authorization: this.authenticator.getTokens(worker).accessToken,
      },
      throwOnError: true,
    })

    const updated = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: time.id },
      }),
    )

    expect(res.status).to.be.equal(200)
    expect(updated!.processes).to.be.null
  }

  @test()
  async removeScreenshots_unknownIdDenied() {
    const owner = await this.userFixture.createPremiumUser()

    let error: unknown

    try {
      await timeControllerRemoveScreenshots({
        client: this.apiClient(),
        body: { ids: [faker.string.uuid()] },
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
    expect(error.response?.status).to.be.equal(403)
    expect(error.response?.data.name).to.be.equal('UserAccessException')
  }

  @test()
  async removeScreenshots_validationRejectsEmptyIds() {
    const owner = await this.userFixture.createPremiumUser()

    let error: unknown

    try {
      await timeControllerRemoveScreenshots({
        client: this.apiClient(),
        body: { ids: [] },
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
    expect(error.response?.data.errors[0].property).to.be.equal('ids')
  }

  @test()
  async removeProcesses_unknownIdDenied() {
    const owner = await this.userFixture.createPremiumUser()

    let error: unknown

    try {
      await timeControllerRemoveProcesses({
        client: this.apiClient(),
        body: { ids: [faker.string.uuid()] },
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
    expect(error.response?.status).to.be.equal(403)
    expect(error.response?.data.name).to.be.equal('UserAccessException')
  }

  @test()
  async removeProcesses_validationRejectsEmptyIds() {
    const owner = await this.userFixture.createPremiumUser()

    let error: unknown

    try {
      await timeControllerRemoveProcesses({
        client: this.apiClient(),
        body: { ids: [] },
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
    expect(error.response?.data.errors[0].property).to.be.equal('ids')
  }
}
