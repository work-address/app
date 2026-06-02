import faker from 'faker'
import { expect } from 'chai'
import axios from 'axios'
import { suite, test } from '@testdeck/mocha'

import { projectControllerCreate } from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { ProjectRepository } from '@/repository/project-repository'
import { EProjectState } from '@/model/project'

@suite
export class ProjectControllerCreateTest extends BaseControllerTest {
  protected projectRepository: ProjectRepository

  constructor() {
    super()

    this.projectRepository = this.container.get('ProjectRepository')
  }

  @test
  async create() {
    const owner = await this.userFixture.createUser()
    const data = {
      trackScreenshots: false,
      trackProcesses: true,
      title: faker.datatype.uuid(),
      text: faker.datatype.uuid(),
      state: EProjectState.INACTIVE,
    }

    const client = this.apiClient()
    const res = await projectControllerCreate({
      client,
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: data,
      throwOnError: true,
    })

    const locationHeader =
      res.headers['location'] ?? res.headers['Location'] ?? ''
    const id = String(locationHeader).split('/')[3]
    const project = await this.projectRepository.findOneByIdOrFail(id)

    expect(res.status).to.be.equal(201)
    this.expectEmptyResponseBody(res.data)

    expect(project.title).to.be.eq(data.title)
    expect(project.text).to.be.eq(data.text)
    expect(project.trackScreenshots).to.be.eq(data.trackScreenshots)
    expect(project.trackProcesses).to.be.eq(data.trackProcesses)
  }

  @test()
  async create_withWorkerAndViewerAddresses() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const data = {
      trackScreenshots: false,
      trackProcesses: true,
      title: faker.datatype.uuid(),
      text: faker.datatype.uuid(),
      state: EProjectState.ACTIVE,
      workerAddresses: [worker.address],
      viewerAddresses: [viewer.address],
    }

    const res = await projectControllerCreate({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: data,
      throwOnError: true,
    })

    const locationHeader =
      res.headers['location'] ?? res.headers['Location'] ?? ''
    const id = String(locationHeader).split('/')[3]
    const project = await this.projectRepository.findOneByIdOrFail(id)

    expect(res.status).to.be.equal(201)
    expect(project.workerAddresses).to.deep.equal([worker.address])
    expect(project.viewerAddresses).to.deep.equal([viewer.address])
  }

  @test()
  async create_rejectsUnknownWorkerOrViewerAddresses() {
    const owner = await this.userFixture.createUser()

    let error: unknown

    try {
      await projectControllerCreate({
        client: this.apiClient(),
        headers: {
          Authorization: this.authenticator.getTokens(owner).accessToken,
        },
        body: {
          trackScreenshots: false,
          trackProcesses: false,
          title: faker.datatype.uuid(),
          text: faker.datatype.uuid(),
          state: EProjectState.ACTIVE,
          workerAddresses: [faker.datatype.uuid()],
          viewerAddresses: [],
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(500)
    expect(error.response?.data.name).to.be.equal('RejectedExecutionException')
  }

  @test()
  async create_excludesOwnerAddressFromAccessLists() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()

    const res = await projectControllerCreate({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        trackScreenshots: false,
        trackProcesses: false,
        title: faker.datatype.uuid(),
        text: faker.datatype.uuid(),
        state: EProjectState.ACTIVE,
        workerAddresses: [owner.address, worker.address],
        viewerAddresses: [owner.address],
      },
      throwOnError: true,
    })

    const locationHeader =
      res.headers['location'] ?? res.headers['Location'] ?? ''
    const id = String(locationHeader).split('/')[3]
    const project = await this.projectRepository.findOneByIdOrFail(id)

    expect(project.workerAddresses).to.deep.equal([worker.address])
    expect(project.viewerAddresses).to.deep.equal([])
  }

  @test()
  async create_requiresAuthorization() {
    let error: unknown

    try {
      await projectControllerCreate({
        client: this.apiClient(),
        body: {
          title: faker.datatype.uuid(),
          text: faker.datatype.uuid(),
          state: EProjectState.INACTIVE,
          trackScreenshots: false,
          trackProcesses: false,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(401)
  }
}
