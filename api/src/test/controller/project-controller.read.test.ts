import { faker } from '@faker-js/faker'
import { expect } from 'chai'
import axios from 'axios'
import { suite, test } from '@testdeck/mocha'

import {
  projectControllerEdit,
  projectControllerRead,
  projectControllerSearch,
} from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { ProjectRepository } from '@/repository/project-repository'
import { UserRepository } from '@/repository/user-repository'
import { EProjectState } from '@/model/project'
import { User } from '@/entity/user'
import { Project } from '@/entity/project'
import { runPromise } from '@/service/effect-bridge'

@suite
export class ProjectControllerReadTest extends BaseControllerTest {
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

  @test
  async readAsWorker() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    await this.grantAccess(project, owner, worker, viewer)

    const res = await projectControllerRead({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(worker).accessToken,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data.id).to.be.equal(project.id)
    expect(res.data.workerAddresses).to.deep.equal([worker.address])
    expect(res.data.viewerAddresses).to.deep.equal([viewer.address])
    expect(res.data.workers).to.have.length(1)
    const workerInResponse = res.data.workers?.[0] as
      | { id?: string; address?: string }
      | undefined
    expect(workerInResponse?.id).to.equal(worker.id)
    expect(workerInResponse?.address).to.equal(worker.address)
    expect(res.data.viewers).to.have.length(1)
    const viewerInResponse = res.data.viewers?.[0] as
      | { id?: string; address?: string }
      | undefined
    expect(viewerInResponse?.id).to.equal(viewer.id)
    expect(viewerInResponse?.address).to.equal(viewer.address)
  }

  @test
  async readAsViewer() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    await this.grantAccess(project, owner, worker, viewer)

    const res = await projectControllerRead({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(viewer).accessToken,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data.id).to.be.equal(project.id)
    expect(res.data.workerAddresses).to.deep.equal([worker.address])
    expect(res.data.viewerAddresses).to.deep.equal([viewer.address])
    expect(res.data.workers).to.have.length(1)
    const workerInResponse = res.data.workers?.[0] as
      | { id?: string; address?: string }
      | undefined
    expect(workerInResponse?.id).to.equal(worker.id)
    expect(workerInResponse?.address).to.equal(worker.address)
    expect(res.data.viewers).to.have.length(1)
    const viewerInResponse = res.data.viewers?.[0] as
      | { id?: string; address?: string }
      | undefined
    expect(viewerInResponse?.id).to.equal(viewer.id)
    expect(viewerInResponse?.address).to.equal(viewer.address)
  }

  @test
  async readAsNonOwner() {
    const owner = await this.userFixture.createPremiumUser()
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
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    await runPromise(this.projectRepository.saveSingle(project))

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
    // The nested owner is serialized the same way for every member who can
    // read the project, so it carries nothing the owner would not show them.
    expect(owner.roles).to.not.be.empty
    expect(ownerInResponse).to.not.have.property('roles')
    expect(ownerInResponse).to.not.have.property('email')
    expect(ownerInResponse).to.not.have.property('premium')
  }

  @test
  async readAsViewer_nestedUsersCarryNoContactDetails() {
    const userRepository = this.container.get<UserRepository>('UserRepository')
    const [owner, worker, viewer] = await Promise.all([
      this.userFixture.createPremiumUser(),
      this.userFixture.createUser(),
      this.userFixture.createUser(),
    ])
    for (const member of [owner, worker]) {
      member.phone = this.faker.phone()
      member.whatsapp = this.faker.phone()
      await runPromise(userRepository.saveSingle(member))
    }
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    await this.grantAccess(project, owner, worker, viewer)
    const headers = {
      Authorization: this.authenticator.getTokens(viewer).accessToken,
    }

    const read = await projectControllerRead({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers,
      throwOnError: true,
    })
    const search = await projectControllerSearch({
      client: this.apiClient(),
      headers,
      body: { filter: {}, sort: { createdAt: 'DESC' }, page: 0 },
      throwOnError: true,
    })
    const rows = search.data[0] as Array<{ id?: string }>
    const searched = rows.find((row) => row.id === project.id)
    expect(searched, 'the viewer finds the project').to.exist

    // Both ways a viewer reaches the project, and every person nested in it:
    // other members' email and phone stay with their accounts.
    for (const payload of [read.data, searched]) {
      const nested = payload as {
        user?: Record<string, unknown>
        workers?: Array<Record<string, unknown>>
        viewers?: Array<Record<string, unknown>>
      }
      const people = [
        { person: nested.user, expected: owner },
        { person: nested.workers?.[0], expected: worker },
        { person: nested.viewers?.[0], expected: viewer },
      ]
      for (const { person, expected } of people) {
        expect(person?.id).to.be.equal(expected.id)
        expect(person?.address).to.be.equal(expected.address)
        for (const key of ['email', 'phone', 'whatsapp', 'roles', 'premium']) {
          expect(person, key).to.not.have.property(key)
        }
      }
    }
  }

  @test
  async readAsOwner_exposesWorkerAndViewerAddresses() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    project.viewerAddresses = [viewer.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const res = await projectControllerRead({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data.workerAddresses).to.deep.equal([worker.address])
    expect(res.data.viewerAddresses).to.deep.equal([viewer.address])
    expect(res.data.workers).to.have.length(1)
    expect((res.data.workers?.[0] as { id?: string } | undefined)?.id).to.equal(
      worker.id,
    )
    expect(res.data.viewers).to.have.length(1)
    expect((res.data.viewers?.[0] as { id?: string } | undefined)?.id).to.equal(
      viewer.id,
    )
  }

  @test
  async readAsOwner_exposesEmptyAddressLists() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    const res = await projectControllerRead({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data.workerAddresses ?? []).to.deep.equal([])
    expect(res.data.viewerAddresses ?? []).to.deep.equal([])
    expect(res.data.workers ?? []).to.deep.equal([])
    expect(res.data.viewers ?? []).to.deep.equal([])
  }

  @test()
  async readAsOwner_preservesWorkerAndViewerOrder() {
    const owner = await this.userFixture.createPremiumUser()
    const workerA = await this.userFixture.createUser()
    const workerB = await this.userFixture.createUser()
    const viewerA = await this.userFixture.createUser()
    const viewerB = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [workerB.address, workerA.address]
    project.viewerAddresses = [viewerB.address, viewerA.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const res = await projectControllerRead({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      throwOnError: true,
    })

    expect(res.data.workerAddresses).to.deep.equal([
      workerB.address,
      workerA.address,
    ])
    expect(res.data.viewerAddresses).to.deep.equal([
      viewerB.address,
      viewerA.address,
    ])
    expect(
      (res.data.workers as Array<{ id?: string }> | undefined)?.map(
        (user) => user.id,
      ),
    ).to.deep.equal([workerB.id, workerA.id])
    expect(
      (res.data.viewers as Array<{ id?: string }> | undefined)?.map(
        (user) => user.id,
      ),
    ).to.deep.equal([viewerB.id, viewerA.id])
  }

  @test()
  async read_withoutAuthorization_unauthorized() {
    const owner = await this.userFixture.createPremiumUser()
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
    const owner = await this.userFixture.createPremiumUser()

    let error: unknown

    try {
      await projectControllerRead({
        client: this.apiClient(),
        path: { id: faker.string.uuid() as never },
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
}
