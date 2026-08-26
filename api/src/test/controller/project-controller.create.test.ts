import { faker } from '@faker-js/faker'
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
    const owner = await this.userFixture.createPremiumUser()
    const data = {
      trackScreenshots: false,
      trackProcesses: true,
      title: faker.string.uuid(),
      text: faker.string.uuid(),
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
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const data = {
      trackScreenshots: false,
      trackProcesses: true,
      title: faker.string.uuid(),
      text: faker.string.uuid(),
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
  async create_allowsWorkerOrViewerAddressesWithNoAccountYet() {
    const owner = await this.userFixture.createPremiumUser()
    // A collaborator may be granted access before their wallet has ever
    // signed in — no matching user account is required at add-time.
    const pendingAddress = faker.string.uuid()

    const res = await projectControllerCreate({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        trackScreenshots: false,
        trackProcesses: false,
        title: faker.string.uuid(),
        text: faker.string.uuid(),
        state: EProjectState.ACTIVE,
        workerAddresses: [pendingAddress],
        viewerAddresses: [],
      },
      throwOnError: true,
    })

    const locationHeader =
      res.headers['location'] ?? res.headers['Location'] ?? ''
    const id = String(locationHeader).split('/')[3]
    const project = await this.projectRepository.findOneByIdOrFail(id)

    expect(res.status).to.be.equal(201)
    expect(project.workerAddresses).to.deep.equal([pendingAddress])
  }

  @test()
  async create_excludesOwnerAddressFromAccessLists() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()

    const res = await projectControllerCreate({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        trackScreenshots: false,
        trackProcesses: false,
        title: faker.string.uuid(),
        text: faker.string.uuid(),
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
          title: faker.string.uuid(),
          text: faker.string.uuid(),
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
