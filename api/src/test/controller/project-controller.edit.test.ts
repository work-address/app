import faker from 'faker'
import { expect } from 'chai'
import axios from 'axios'
import { suite, test } from '@testdeck/mocha'

import { projectControllerEdit } from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { ProjectRepository } from '@/repository/project-repository'
import { EProjectState } from '@/model/project'

@suite
export class ProjectControllerEditTest extends BaseControllerTest {
  protected projectRepository: ProjectRepository

  constructor() {
    super()

    this.projectRepository = this.container.get('ProjectRepository')
  }

  @test
  async edit() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.INACTIVE,
    )

    const data = {
      title: faker.datatype.uuid(),
      text: faker.datatype.uuid(),
      state: EProjectState.ACTIVE,
      trackScreenshots: true,
      trackProcesses: true,
    }

    const client = this.apiClient()
    const res = await projectControllerEdit({
      client,
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: data,
      throwOnError: true,
    })

    const projectUpdated = await this.projectRepository.findOneByIdOrFail(
      project.id,
    )

    expect(res.status).to.be.equal(200)
    this.expectEmptyResponseBody(res.data)

    expect(projectUpdated.title).to.be.eq(data.title)
    expect(projectUpdated.state).to.be.eq(data.state)
    expect(projectUpdated.text).to.be.eq(data.text)
    expect(projectUpdated.trackScreenshots).to.be.eq(data.trackScreenshots)
    expect(projectUpdated.trackProcesses).to.be.eq(data.trackProcesses)
  }

  @test()
  async edit_updatesWorkerAndViewerAddresses() {
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

    const projectUpdated = await this.projectRepository.findOneByIdOrFail(
      project.id,
    )

    expect(projectUpdated.workerAddresses).to.deep.equal([worker.address])
    expect(projectUpdated.viewerAddresses).to.deep.equal([viewer.address])
  }

  @test()
  async edit_deniedForNonOwner() {
    const owner = await this.userFixture.createUser()
    const other = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.INACTIVE,
    )
    const data = {
      title: faker.datatype.uuid(),
      text: faker.datatype.uuid(),
      state: EProjectState.ACTIVE,
      trackScreenshots: true,
      trackProcesses: true,
    }

    let error: unknown

    try {
      await projectControllerEdit({
        client: this.apiClient(),
        path: { id: project.id as never },
        headers: {
          Authorization: this.authenticator.getTokens(other).accessToken,
        },
        body: data,
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(401)

    const unchanged = await this.projectRepository.findOneByIdOrFail(project.id)
    expect(unchanged.title).to.not.eq(data.title)
  }
}
