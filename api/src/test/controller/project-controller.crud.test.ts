import faker from 'faker'
import { expect } from 'chai'
import axios from 'axios'
import { suite, test } from '@testdeck/mocha'

import {
  projectControllerCreate,
  projectControllerDelete,
  projectControllerEdit,
  projectControllerRead,
} from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { ProjectRepository } from '@/repository/project-repository'
import { EProjectState } from '@/model/project'

@suite
export class ProjectControllerCrudTest extends BaseControllerTest {
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

  @test
  async readAsNonOwner() {
    const owner = await this.userFixture.createUser()
    const other = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    let error: unknown

    try {
      await projectControllerRead({
        client: this.apiClient(),
        path: { id: project.id as never },
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
    expect(error.response?.status).to.be.equal(404)
  }

  @test
  async readAsOwner() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    await this.projectRepository.saveSingle(project)

    const client = this.apiClient()
    const res = await projectControllerRead({
      client,
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data.id).to.be.equal(project.id)
    expect(res.data.state).to.be.equal(EProjectState.ACTIVE)
    const ownerInResponse = (
      res.data as { user?: { id?: string; address?: string; roles?: string[] } }
    ).user
    expect(ownerInResponse?.id).to.be.equal(owner.id)
    expect(ownerInResponse?.address).to.be.equal(owner.address)
    expect(ownerInResponse?.roles).to.deep.equal(owner.roles)
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

  @test
  async delete() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    const client = this.apiClient()
    const res = await projectControllerDelete({
      client,
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      throwOnError: true,
    })

    const updated = await this.projectRepository.findOneBy({
      where: {
        id: project.id,
      },
    })

    expect(res.status).to.be.equal(200)
    this.expectEmptyResponseBody(res.data)
    expect(updated).to.be.undefined
  }

  @test()
  async read_withoutAuthorization_unauthorized() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    let error: unknown

    try {
      await projectControllerRead({
        client: this.apiClient(),
        path: { id: project.id as never },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(401)
  }

  @test()
  async read_unknownProject_notFound() {
    const owner = await this.userFixture.createUser()

    let error: unknown

    try {
      await projectControllerRead({
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

  @test()
  async delete_nonOwner_doesNotRemoveProject() {
    const owner = await this.userFixture.createUser()
    const other = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    const res = await projectControllerDelete({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(other).accessToken,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)

    const stillThere = await this.projectRepository.findOneBy({
      where: { id: project.id },
    })
    expect(stillThere).to.not.eq(undefined)
    expect(stillThere!.id).to.be.eq(project.id)
  }
}
