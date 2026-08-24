import faker from 'faker'
import { expect } from 'chai'
import axios from 'axios'
import { suite, test } from '@testdeck/mocha'

import { projectControllerEdit } from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { ProjectRepository } from '@/repository/project-repository'
import { EProjectState } from '@/model/project'
import { User } from '@/entity/user'
import { Project } from '@/entity/project'

@suite
export class ProjectControllerAccessTest extends BaseControllerTest {
  protected projectRepository: ProjectRepository

  constructor() {
    super()

    this.projectRepository = this.container.get('ProjectRepository')
  }

  private editProject(
    project: Project,
    owner: User,
    body: Record<string, unknown>,
  ) {
    return projectControllerEdit({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        title: project.title,
        text: project.text,
        state: project.state,
        ...body,
      },
      throwOnError: true,
    })
  }

  @test
  async edit_setsWorkerAndViewerAddressesAsOwner() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    const res = await this.editProject(project, owner, {
      workerAddresses: [worker.address],
      viewerAddresses: [viewer.address],
    })

    const projectUpdated = await this.projectRepository.findOneByIdOrFail(
      project.id,
    )

    expect(res.status).to.be.equal(200)
    this.expectEmptyResponseBody(res.data)
    expect(projectUpdated.workerAddresses).to.deep.equal([worker.address])
    expect(projectUpdated.viewerAddresses).to.deep.equal([viewer.address])
  }

  @test
  async edit_replacesExistingAccessLists() {
    const owner = await this.userFixture.createPremiumUser()
    const workerA = await this.userFixture.createUser()
    const workerB = await this.userFixture.createUser()
    const viewerA = await this.userFixture.createUser()
    const viewerB = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    await this.editProject(project, owner, {
      workerAddresses: [workerA.address],
      viewerAddresses: [viewerA.address],
    })

    await this.editProject(project, owner, {
      workerAddresses: [workerB.address],
      viewerAddresses: [viewerB.address],
    })

    const projectUpdated = await this.projectRepository.findOneByIdOrFail(
      project.id,
    )

    expect(projectUpdated.workerAddresses).to.deep.equal([workerB.address])
    expect(projectUpdated.viewerAddresses).to.deep.equal([viewerB.address])
  }

  @test
  async edit_clearsAccessListsWithEmptyArrays() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    await this.editProject(project, owner, {
      workerAddresses: [worker.address],
      viewerAddresses: [viewer.address],
    })

    await this.editProject(project, owner, {
      workerAddresses: [],
      viewerAddresses: [],
    })

    const projectUpdated = await this.projectRepository.findOneByIdOrFail(
      project.id,
    )

    expect(projectUpdated.workerAddresses).to.deep.equal([])
    expect(projectUpdated.viewerAddresses).to.deep.equal([])
  }

  @test
  async edit_excludesOwnerAddressFromAccessLists() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    await this.editProject(project, owner, {
      workerAddresses: [owner.address, worker.address],
      viewerAddresses: [owner.address],
    })

    const projectUpdated = await this.projectRepository.findOneByIdOrFail(
      project.id,
    )

    expect(projectUpdated.workerAddresses).to.deep.equal([worker.address])
    expect(projectUpdated.viewerAddresses).to.deep.equal([])
  }

  @test
  async edit_deduplicatesAccessAddresses() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    await this.editProject(project, owner, {
      workerAddresses: [worker.address, worker.address],
      viewerAddresses: [worker.address, worker.address],
    })

    const projectUpdated = await this.projectRepository.findOneByIdOrFail(
      project.id,
    )

    expect(projectUpdated.workerAddresses).to.deep.equal([worker.address])
    expect(projectUpdated.viewerAddresses).to.deep.equal([worker.address])
  }

  @test
  async edit_accessDeniedForNonOwner() {
    const owner = await this.userFixture.createPremiumUser()
    const other = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    let error: unknown

    try {
      await projectControllerEdit({
        client: this.apiClient(),
        path: { id: project.id as never },
        headers: {
          Authorization: this.authenticator.getTokens(other).accessToken,
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
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(401)
    expect(error.response?.data.name).to.be.equal('UserAccessException')

    const unchanged = await this.projectRepository.findOneByIdOrFail(project.id)
    expect(unchanged.workerAddresses ?? []).to.deep.equal([])
    expect(unchanged.viewerAddresses ?? []).to.deep.equal([])
  }

  @test
  async edit_allowsAccessAddressesWithNoAccountYet() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    // A collaborator may be granted access before their wallet has ever
    // signed in — no matching user account is required at add-time.
    const pendingAddress = faker.datatype.uuid()

    const res = await this.editProject(project, owner, {
      workerAddresses: [pendingAddress],
      viewerAddresses: [],
    })

    const projectUpdated = await this.projectRepository.findOneByIdOrFail(
      project.id,
    )

    expect(res.status).to.be.equal(200)
    expect(projectUpdated.workerAddresses).to.deep.equal([pendingAddress])
  }

  @test
  async edit_unknownProject_notFound() {
    const owner = await this.userFixture.createPremiumUser()

    let error: unknown

    try {
      await projectControllerEdit({
        client: this.apiClient(),
        path: { id: faker.datatype.uuid() as never },
        headers: {
          Authorization: this.authenticator.getTokens(owner).accessToken,
        },
        body: {
          title: 'x',
          text: 'y',
          state: EProjectState.ACTIVE,
          workerAddresses: [],
          viewerAddresses: [],
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
  async edit_requiresAuthorization() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    let error: unknown

    try {
      await projectControllerEdit({
        client: this.apiClient(),
        path: { id: project.id as never },
        body: {
          title: project.title,
          text: project.text,
          state: project.state,
          workerAddresses: [],
          viewerAddresses: [],
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(401)
  }

  @test()
  async edit_updatesOnlyWorkerAddresses_preservesViewerAddresses() {
    const owner = await this.userFixture.createPremiumUser()
    const workerA = await this.userFixture.createUser()
    const workerB = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    await this.editProject(project, owner, {
      workerAddresses: [workerA.address],
      viewerAddresses: [viewer.address],
    })

    await this.editProject(project, owner, {
      workerAddresses: [workerB.address],
    })

    const updated = await this.projectRepository.findOneByIdOrFail(project.id)
    expect(updated.workerAddresses).to.deep.equal([workerB.address])
    expect(updated.viewerAddresses).to.deep.equal([viewer.address])
  }

  @test()
  async edit_updatesOnlyViewerAddresses_preservesWorkerAddresses() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewerA = await this.userFixture.createUser()
    const viewerB = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    await this.editProject(project, owner, {
      workerAddresses: [worker.address],
      viewerAddresses: [viewerA.address],
    })

    await this.editProject(project, owner, {
      viewerAddresses: [viewerB.address],
    })

    const updated = await this.projectRepository.findOneByIdOrFail(project.id)
    expect(updated.workerAddresses).to.deep.equal([worker.address])
    expect(updated.viewerAddresses).to.deep.equal([viewerB.address])
  }

  @test()
  async edit_omittingAccessFields_leavesListsUnchanged() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    await this.editProject(project, owner, {
      workerAddresses: [worker.address],
      viewerAddresses: [viewer.address],
    })

    const newTitle = faker.datatype.uuid()
    await this.editProject(project, owner, {
      title: newTitle,
    })

    const updated = await this.projectRepository.findOneByIdOrFail(project.id)
    expect(updated.title).to.equal(newTitle)
    expect(updated.workerAddresses).to.deep.equal([worker.address])
    expect(updated.viewerAddresses).to.deep.equal([viewer.address])
  }
}
