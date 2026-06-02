import { expect } from 'chai'
import axios from 'axios'
import moment from 'moment'
import { suite, test } from '@testdeck/mocha'

import {
  projectControllerDelete,
  projectControllerEdit,
  projectControllerRead,
  projectControllerSearch,
  timeControllerCreateOrUpdateMany,
} from '@app/api-client'
import type { TimeCreateDto as ApiTimeCreateDto } from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { ProjectRepository } from '@/repository/project-repository'
import { EProjectState } from '@/model/project'
import { User } from '@/entity/user'
import { Project } from '@/entity/project'

@suite
export class ProjectControllerLifecycleTest extends BaseControllerTest {
  protected projectRepository: ProjectRepository

  constructor() {
    super()
    this.projectRepository = this.container.get('ProjectRepository')
  }

  private async grantAccess(
    project: Project,
    owner: User,
    worker: User,
    viewer: User,
  ) {
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
  }

  private async revokeWorkerAccess(
    project: Project,
    owner: User,
    viewer: User,
  ) {
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
        workerAddresses: [],
        viewerAddresses: [viewer.address],
      },
      throwOnError: true,
    })
  }

  @test()
  async read_returns404AfterWorkerRemovedFromAccessLists() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    await this.grantAccess(project, owner, worker, viewer)
    await this.revokeWorkerAccess(project, owner, viewer)

    let error: unknown

    try {
      await projectControllerRead({
        client: this.apiClient(),
        path: { id: project.id as never },
        headers: {
          Authorization: this.authenticator.getTokens(worker).accessToken,
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
  async search_excludesProjectAfterWorkerRemovedFromAccessLists() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    await this.grantAccess(project, owner, worker, viewer)
    await this.revokeWorkerAccess(project, owner, viewer)

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(worker).accessToken,
      },
      body: {
        filter: { projectId: project.id },
        sort: { createdAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    const rows = res.data[0] as unknown[]
    expect(rows).to.deep.equal([])
    expect(res.data[1]).to.equal(0)
  }

  @test()
  async read_search_deniedForSoftDeletedProject() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    await this.grantAccess(project, owner, worker, viewer)

    await projectControllerDelete({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      throwOnError: true,
    })

    let readError: unknown

    try {
      await projectControllerRead({
        client: this.apiClient(),
        path: { id: project.id as never },
        headers: {
          Authorization: this.authenticator.getTokens(worker).accessToken,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      readError = e
    }

    if (!axios.isAxiosError(readError)) throw readError
    expect(readError.response?.status).to.be.equal(404)

    const searchRes = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(worker).accessToken,
      },
      body: {
        filter: { projectId: project.id },
        sort: { createdAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(searchRes.data[0]).to.deep.equal([])
    expect(searchRes.data[1]).to.equal(0)
  }

  @test()
  async viewerCannotTrackTimeOnSharedProject() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    await this.grantAccess(project, owner, worker, viewer)

    const fromAt = moment.utc().subtract(10, 'minutes').toISOString()
    const toAt = moment.utc().toISOString()
    const res = await timeControllerCreateOrUpdateMany({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(viewer).accessToken,
      },
      body: [
        {
          fromIndex: 1000,
          toIndex: 1001,
          note: 'viewer entry',
          keyboardKeys: 1,
          minutesActive: 10,
          mouseKeys: 1,
          mouseDistance: 1,
          fromAt,
          toAt,
          projectId: project.id,
        },
      ] as ApiTimeCreateDto[],
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data[0]).to.have.property('error')
    expect(res.data[0].error?.name).to.be.equal('EntityNotFoundError')
  }

  @test()
  async trackTime_deniedWhenProjectInactive() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.INACTIVE,
    )
    await this.grantAccess(project, owner, worker, viewer)

    const fromAt = moment.utc().subtract(10, 'minutes').toISOString()
    const toAt = moment.utc().toISOString()
    const res = await timeControllerCreateOrUpdateMany({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(worker).accessToken,
      },
      body: [
        {
          fromIndex: 2000,
          toIndex: 2001,
          note: 'inactive project entry',
          keyboardKeys: 1,
          minutesActive: 10,
          mouseKeys: 1,
          mouseDistance: 1,
          fromAt,
          toAt,
          projectId: project.id,
        },
      ] as ApiTimeCreateDto[],
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data[0]).to.have.property('error')
    expect(res.data[0].error?.name).to.be.equal('EntityNotFoundError')
  }
}
