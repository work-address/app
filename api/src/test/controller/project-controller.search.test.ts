import { expect } from 'chai'
import axios from 'axios'
import faker from 'faker'
import { suite, test } from '@testdeck/mocha'

import {
  projectControllerEdit,
  projectControllerSearch,
} from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { ProjectRepository } from '@/repository/project-repository'
import { EProjectState } from '@/model/project'
import { User } from '@/entity/user'
import { Project } from '@/entity/project'

@suite
export class ProjectControllerSearchTest extends BaseControllerTest {
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

  @test()
  async search_returnsSharedProjectsForWorkerAndViewer() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const owned = await this.projectFixture.createPersonal(owner)
    const shared = await this.projectFixture.create(owner, EProjectState.ACTIVE)
    await this.grantAccess(shared, owner, worker, viewer)

    const searchBody = {
      filter: {},
      sort: { createdAt: 'ASC' as const },
      page: 0,
    }

    const workerRes = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(worker).accessToken,
      },
      body: searchBody,
      throwOnError: true,
    })

    const viewerRes = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(viewer).accessToken,
      },
      body: searchBody,
      throwOnError: true,
    })

    const workerIds = (workerRes.data[0] as Array<{ id: string }>).map(
      (row) => row.id,
    )
    const viewerIds = (viewerRes.data[0] as Array<{ id: string }>).map(
      (row) => row.id,
    )

    expect(workerIds).to.include(shared.id)
    expect(workerIds).to.not.include(owned.id)
    expect(viewerIds).to.include(shared.id)
    expect(viewerIds).to.not.include(owned.id)
  }

  @test()
  async search_asOwner_includesAllOwnedProjects() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const first = await this.projectFixture.createPersonal(owner)
    const second = await this.projectFixture.create(owner, EProjectState.ACTIVE)
    await this.grantAccess(second, owner, worker, viewer)

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        filter: {},
        sort: { createdAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    const ids = (res.data[0] as Array<{ id: string }>).map((row) => row.id)
    expect(ids).to.include(first.id)
    expect(ids).to.include(second.id)
    expect(res.data[1]).to.be.eq(2)
  }

  @test()
  async search_excludesProjectsWithoutAccess() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const outsider = await this.userFixture.createUser()
    const shared = await this.projectFixture.create(owner, EProjectState.ACTIVE)
    await this.grantAccess(shared, owner, worker, viewer)

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(outsider).accessToken,
      },
      body: {
        filter: { projectId: shared.id },
        sort: { createdAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data[0]).to.deep.equal([])
    expect(res.data[1]).to.be.eq(0)
  }

  @test()
  async search_filterProjectId_asWorkerAndViewer() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(owner, EProjectState.ACTIVE)
    await this.grantAccess(project, owner, worker, viewer)

    const searchBody = {
      filter: { projectId: project.id },
      sort: { createdAt: 'ASC' as const },
      page: 0,
    }

    const workerRes = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(worker).accessToken,
      },
      body: searchBody,
      throwOnError: true,
    })

    const viewerRes = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(viewer).accessToken,
      },
      body: searchBody,
      throwOnError: true,
    })

    expect((workerRes.data[0] as Array<{ id: string }>).length).to.be.eq(1)
    expect((workerRes.data[0] as Array<{ id: string }>)[0].id).to.be.eq(
      project.id,
    )
    expect((viewerRes.data[0] as Array<{ id: string }>).length).to.be.eq(1)
    expect((viewerRes.data[0] as Array<{ id: string }>)[0].id).to.be.eq(
      project.id,
    )
  }

  @test()
  async searchUserPersonalSorted() {
    const user = await this.userFixture.createUser()
    const projectA = await this.projectFixture.createPersonal(user)
    const projectB = await this.projectFixture.createPersonal(user)
    const projectC = await this.projectFixture.createPersonal(user)

    projectA.title = 'AAA'
    projectB.title = 'BBB'
    projectC.title = 'CCC'

    await this.projectRepository.saveMany([projectA, projectB, projectC])

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {},
        sort: { title: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{
      title: string
      state: EProjectState
      user?: { id?: string; address?: string; roles?: string[] }
    }>
    expect(rows.length).to.be.eq(3)
    expect(rows[0].title).to.be.eq(projectA.title)
    expect(rows[1].title).to.be.eq(projectB.title)
    expect(rows[2].title).to.be.eq(projectC.title)
    expect(rows[0].state).to.be.eq(EProjectState.ACTIVE)
    expect(rows[0].user?.id).to.be.eq(user.id)
    expect(rows[0].user?.address).to.be.eq(user.address)
    expect(rows[0].user?.roles).to.deep.eq(user.roles)
  }

  @test()
  async search_exposesWorkerAndViewerAddresses() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    project.viewerAddresses = [viewer.address]
    await this.projectRepository.saveSingle(project)

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        filter: { projectId: project.id },
        sort: { createdAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{
      workerAddresses?: string[]
      viewerAddresses?: string[]
      workers?: Array<{ id?: string; address?: string }>
      viewers?: Array<{ id?: string; address?: string }>
    }>
    expect(rows.length).to.be.eq(1)
    expect(rows[0].workerAddresses).to.deep.equal([worker.address])
    expect(rows[0].viewerAddresses).to.deep.equal([viewer.address])
    expect(rows[0].workers).to.have.length(1)
    expect(rows[0].workers?.[0]?.id).to.equal(worker.id)
    expect(rows[0].workers?.[0]?.address).to.equal(worker.address)
    expect(rows[0].viewers).to.have.length(1)
    expect(rows[0].viewers?.[0]?.id).to.equal(viewer.id)
    expect(rows[0].viewers?.[0]?.address).to.equal(viewer.address)
  }

  @test()
  async search_exposesEmptyAddressLists() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        filter: { projectId: project.id },
        sort: { createdAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{
      workerAddresses?: string[]
      viewerAddresses?: string[]
      workers?: unknown[]
      viewers?: unknown[]
    }>
    expect(rows.length).to.be.eq(1)
    expect(rows[0].workerAddresses ?? []).to.deep.equal([])
    expect(rows[0].viewerAddresses ?? []).to.deep.equal([])
    expect(rows[0].workers ?? []).to.deep.equal([])
    expect(rows[0].viewers ?? []).to.deep.equal([])
  }

  @test()
  async search_asWorker_exposesWorkersAndViewers() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const shared = await this.projectFixture.create(owner, EProjectState.ACTIVE)
    await this.grantAccess(shared, owner, worker, viewer)

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(worker).accessToken,
      },
      body: {
        filter: { projectId: shared.id },
        sort: { createdAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    const rows = res.data[0] as Array<{
      workerAddresses?: string[]
      viewerAddresses?: string[]
      workers?: Array<{ id?: string }>
      viewers?: Array<{ id?: string }>
    }>

    expect(rows.length).to.be.eq(1)
    expect(rows[0].workerAddresses).to.deep.equal([worker.address])
    expect(rows[0].viewerAddresses).to.deep.equal([viewer.address])
    expect(rows[0].workers?.[0]?.id).to.equal(worker.id)
    expect(rows[0].viewers?.[0]?.id).to.equal(viewer.id)
  }

  @test()
  async search_asViewer_exposesWorkersAndViewers() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const shared = await this.projectFixture.create(owner, EProjectState.ACTIVE)
    await this.grantAccess(shared, owner, worker, viewer)

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(viewer).accessToken,
      },
      body: {
        filter: { projectId: shared.id },
        sort: { createdAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    const rows = res.data[0] as Array<{
      workerAddresses?: string[]
      viewerAddresses?: string[]
      workers?: Array<{ id?: string }>
      viewers?: Array<{ id?: string }>
    }>

    expect(rows.length).to.be.eq(1)
    expect(rows[0].workerAddresses).to.deep.equal([worker.address])
    expect(rows[0].viewerAddresses).to.deep.equal([viewer.address])
    expect(rows[0].workers?.[0]?.id).to.equal(worker.id)
    expect(rows[0].viewers?.[0]?.id).to.equal(viewer.id)
  }

  @test()
  async search_multipleProjects_attachWorkersAndViewersPerProject() {
    const owner = await this.userFixture.createPremiumUser()
    const workerA = await this.userFixture.createUser()
    const workerB = await this.userFixture.createUser()
    const viewerA = await this.userFixture.createUser()
    const viewerB = await this.userFixture.createUser()
    const first = await this.projectFixture.create(owner, EProjectState.ACTIVE)
    first.workerAddresses = [workerA.address]
    first.viewerAddresses = [viewerA.address]
    await this.projectRepository.saveSingle(first)
    const second = await this.projectFixture.create(owner, EProjectState.ACTIVE)
    second.workerAddresses = [workerB.address]
    second.viewerAddresses = [viewerB.address]
    await this.projectRepository.saveSingle(second)

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        filter: {},
        sort: { createdAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    const rows = res.data[0] as Array<{
      id: string
      workers?: Array<{ id?: string }>
      viewers?: Array<{ id?: string }>
    }>
    const firstRow = rows.find((row) => row.id === first.id)
    const secondRow = rows.find((row) => row.id === second.id)

    expect(firstRow?.workers?.map((user) => user.id)).to.deep.equal([
      workerA.id,
    ])
    expect(firstRow?.viewers?.map((user) => user.id)).to.deep.equal([
      viewerA.id,
    ])
    expect(secondRow?.workers?.map((user) => user.id)).to.deep.equal([
      workerB.id,
    ])
    expect(secondRow?.viewers?.map((user) => user.id)).to.deep.equal([
      viewerB.id,
    ])
  }

  @test()
  async search_preservesWorkerAndViewerOrder() {
    const owner = await this.userFixture.createPremiumUser()
    const workerA = await this.userFixture.createUser()
    const workerB = await this.userFixture.createUser()
    const viewerA = await this.userFixture.createUser()
    const viewerB = await this.userFixture.createUser()
    const project = await this.projectFixture.create(owner, EProjectState.ACTIVE)
    project.workerAddresses = [workerB.address, workerA.address]
    project.viewerAddresses = [viewerB.address, viewerA.address]
    await this.projectRepository.saveSingle(project)

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        filter: { projectId: project.id },
        sort: { createdAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    const row = (
      res.data[0] as Array<{
        workerAddresses?: string[]
        viewerAddresses?: string[]
        workers?: Array<{ id?: string; address?: string }>
        viewers?: Array<{ id?: string; address?: string }>
      }>
    )[0]

    expect(row.workerAddresses).to.deep.equal([
      workerB.address,
      workerA.address,
    ])
    expect(row.viewerAddresses).to.deep.equal([
      viewerB.address,
      viewerA.address,
    ])
    expect(row.workers?.map((user) => user.id)).to.deep.equal([
      workerB.id,
      workerA.id,
    ])
    expect(row.viewers?.map((user) => user.id)).to.deep.equal([
      viewerB.id,
      viewerA.id,
    ])
  }

  @test()
  async searchFiltersByIdentityAndState() {
    const user = await this.userFixture.createUser()
    const anotherUser = await this.userFixture.createUser()
    const target = await this.projectFixture.create(
      user,
      EProjectState.INACTIVE,
    )
    await this.projectFixture.create(user, EProjectState.ACTIVE)
    await this.projectFixture.create(anotherUser, EProjectState.INACTIVE)

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {
          userId: user.id,
          projectId: target.id,
          state: EProjectState.INACTIVE,
        },
        sort: { createdAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string; state: EProjectState }>
    expect(rows.length).to.be.eq(1)
    expect(rows[0].id).to.be.eq(target.id)
    expect(rows[0].state).to.be.eq(EProjectState.INACTIVE)
  }

  @test()
  async searchFiltersByTextRateAndTrackingFlags() {
    const user = await this.userFixture.createUser()
    const match = await this.projectFixture.createPersonal(
      user,
      120,
      true,
      false,
    )
    const mismatch = await this.projectFixture.createPersonal(
      user,
      50,
      false,
      true,
    )

    match.title = 'invoice processing'
    match.text = 'monthly billing project'
    mismatch.title = 'support desk'
    mismatch.text = 'tickets and chats'

    await this.projectRepository.saveMany([match, mismatch])

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {
          title: 'invoice',
          text: 'billing',
          rateHourFrom: 100,
          rateHourTo: 150,
          trackScreenshots: true,
          trackProcesses: false,
          withScreenshots: true,
          withProcesses: false,
        },
        sort: { createdAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(1)
    expect(rows[0].id).to.be.eq(match.id)
  }

  @test()
  async searchReturnsEmptyWhenNoRowsMatch() {
    const user = await this.userFixture.createUser()
    await this.projectFixture.createPersonal(user)

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {
          title: 'missing-title',
        },
        sort: { createdAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(0)
    expect(res.data[1]).to.be.eq(0)
  }

  @test()
  async searchRejectsInvalidFilterFieldType() {
    const user = await this.userFixture.createUser()

    let error: unknown

    try {
      await projectControllerSearch({
        client: this.apiClient(),
        headers: {
          Authorization: this.authenticator.getTokens(user).accessToken,
        },
        body: {
          filter: { projectId: faker.datatype.number() as never },
          sort: { createdAt: 'ASC' },
          page: 0,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(400)
  }

  @test()
  async search_sortByTitle_desc() {
    const user = await this.userFixture.createUser()
    const low = await this.projectFixture.createPersonal(user)
    const mid = await this.projectFixture.createPersonal(user)
    const high = await this.projectFixture.createPersonal(user)

    low.title = 'alpha'
    mid.title = 'mike'
    high.title = 'zebra'

    await this.projectRepository.saveMany([low, mid, high])

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {},
        sort: { title: 'DESC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ title: string }>
    expect(rows.map((r) => r.title)).to.deep.eq(['zebra', 'mike', 'alpha'])
  }

  @test()
  async search_pagination_limitAndSecondPage() {
    const user = await this.userFixture.createUser()
    const titles = ['A', 'B', 'C', 'D']
    const projects = await Promise.all(
      titles.map(() => this.projectFixture.createPersonal(user)),
    )
    titles.forEach((title, i) => {
      projects[i].title = title
    })
    await this.projectRepository.saveMany(projects)

    const first = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {},
        sort: { title: 'ASC' },
        page: 0,
        limit: 2,
      },
      throwOnError: true,
    })
    expect(first.status).to.be.equal(200)

    const second = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {},
        sort: { title: 'ASC' },
        page: 1,
        limit: 2,
      },
      throwOnError: true,
    })
    expect(second.status).to.be.equal(200)

    const slice0 = first.data[0] as Array<{ title: string }>
    const slice1 = second.data[0] as Array<{ title: string }>
    expect(first.data[1]).to.be.eq(4)
    expect(second.data[1]).to.be.eq(4)
    expect(slice0.map((r) => r.title)).to.deep.eq(['A', 'B'])
    expect(slice1.map((r) => r.title)).to.deep.eq(['C', 'D'])
  }

  @test()
  async search_customLimit_returnsAtMostLimitRows() {
    const user = await this.userFixture.createUser()
    const projects = await Promise.all([
      this.projectFixture.createPersonal(user),
      this.projectFixture.createPersonal(user),
      this.projectFixture.createPersonal(user),
    ])
    projects[0].title = 'p1'
    projects[1].title = 'p2'
    projects[2].title = 'p3'
    await this.projectRepository.saveMany(projects)

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {},
        sort: { title: 'ASC' },
        page: 0,
        limit: 2,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ title: string }>
    expect(rows.length).to.be.eq(2)
    expect(res.data[1]).to.be.eq(3)
  }

  @test()
  async search_sortByRateHour_asc() {
    const user = await this.userFixture.createUser()
    const hi = await this.projectFixture.createPersonal(user, 300)
    const lo = await this.projectFixture.createPersonal(user, 50)
    const mid = await this.projectFixture.createPersonal(user, 120)

    lo.title = 'r-lo'
    mid.title = 'r-mid'
    hi.title = 'r-hi'

    await this.projectRepository.saveMany([hi, lo, mid])

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {},
        sort: { rateHour: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{
      rateHour: string | number
      title: string
    }>
    expect(rows.map((r) => r.title)).to.deep.eq(['r-lo', 'r-mid', 'r-hi'])
    expect(rows.map((r) => Number(r.rateHour))).to.deep.eq([50, 120, 300])
  }

  @test()
  async search_sortByState_asc() {
    const user = await this.userFixture.createUser()
    const inactive = await this.projectFixture.create(
      user,
      EProjectState.INACTIVE,
    )
    const active = await this.projectFixture.create(user, EProjectState.ACTIVE)

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {},
        sort: { state: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string; state: EProjectState }>
    expect(rows.length).to.be.eq(2)
    expect(rows[0].id).to.be.eq(active.id)
    expect(rows[1].id).to.be.eq(inactive.id)
  }

  @test()
  async search_sortByUpdatedAt_desc() {
    const user = await this.userFixture.createUser()
    const marker = faker.datatype.uuid()
    const older = await this.projectFixture.createPersonal(user)
    await new Promise((resolve) => setTimeout(resolve, 30))
    const newer = await this.projectFixture.createPersonal(user)

    older.title = `upd-sort-older-${marker}`
    newer.title = `upd-sort-newer-${marker}`
    await this.projectRepository.saveMany([older, newer])
    await new Promise((resolve) => setTimeout(resolve, 30))
    older.text = `upd-sort-touch-${marker}`
    await this.projectRepository.saveMany([older])

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: { title: marker },
        sort: { updatedAt: 'DESC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string; title: string }>
    expect(rows.length).to.be.eq(2)
    expect(rows[0].id).to.be.eq(older.id)
    expect(rows[1].id).to.be.eq(newer.id)
  }

  @test()
  async search_sortByTrackScreenshots_desc() {
    const user = await this.userFixture.createUser()
    const withScreens = await this.projectFixture.createPersonal(
      user,
      10,
      true,
      false,
    )
    const withoutScreens = await this.projectFixture.createPersonal(
      user,
      10,
      false,
      false,
    )

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {},
        sort: { trackScreenshots: 'DESC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string; trackScreenshots: boolean }>
    expect(rows.length).to.be.eq(2)
    expect(rows[0].id).to.be.eq(withScreens.id)
    expect(rows[1].id).to.be.eq(withoutScreens.id)
  }

  @test()
  async search_sortByTrackProcesses_desc() {
    const user = await this.userFixture.createUser()
    const withProcesses = await this.projectFixture.createPersonal(
      user,
      10,
      false,
      true,
    )
    const withoutProcesses = await this.projectFixture.createPersonal(
      user,
      10,
      false,
      false,
    )

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {},
        sort: { trackProcesses: 'DESC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string; trackProcesses: boolean }>
    expect(rows.length).to.be.eq(2)
    expect(rows[0].id).to.be.eq(withProcesses.id)
    expect(rows[1].id).to.be.eq(withoutProcesses.id)
  }

  @test()
  async search_filterCombined_stateAndSort() {
    const user = await this.userFixture.createUser()
    const activeA = await this.projectFixture.create(user, EProjectState.ACTIVE)
    const activeB = await this.projectFixture.create(user, EProjectState.ACTIVE)
    await this.projectFixture.create(user, EProjectState.INACTIVE)

    activeA.title = 'early'
    activeB.title = 'late'
    await this.projectRepository.saveMany([activeA, activeB])

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: { state: EProjectState.ACTIVE },
        sort: { title: 'DESC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ title: string; state: EProjectState }>
    expect(rows.length).to.be.eq(2)
    expect(rows.every((r) => r.state === EProjectState.ACTIVE)).to.be.true
    expect(rows.map((r) => r.title)).to.deep.eq(['late', 'early'])
  }

  @test()
  async search_filterUserId_otherOwner_returnsEmpty() {
    const me = await this.userFixture.createUser()
    const other = await this.userFixture.createUser()
    await this.projectFixture.createPersonal(me)

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(me).accessToken,
      },
      body: {
        filter: { userId: other.id },
        sort: { title: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data[0]).to.deep.eq([])
    expect(res.data[1]).to.be.eq(0)
  }

  @test()
  async search_filterTitle_caseInsensitiveSubstring() {
    const user = await this.userFixture.createUser()
    const match = await this.projectFixture.createPersonal(user)
    const miss = await this.projectFixture.createPersonal(user)

    match.title = 'My INVOICE Project'
    miss.title = 'other'
    await this.projectRepository.saveMany([match, miss])

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: { title: 'invoice' },
        sort: { title: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(1)
    expect(rows[0].id).to.be.eq(match.id)
  }

  @test()
  async search_filterText_matchesBodySubstring() {
    const user = await this.userFixture.createUser()
    const match = await this.projectFixture.createPersonal(user)
    const miss = await this.projectFixture.createPersonal(user)

    match.text = 'quarterly RETAINER agreement'
    miss.text = 'one-off gig'
    await this.projectRepository.saveMany([match, miss])

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: { text: 'retainer' },
        sort: { title: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(1)
    expect(rows[0].id).to.be.eq(match.id)
  }

  @test()
  async search_filterRateHourTo_only() {
    const user = await this.userFixture.createUser()
    const low = await this.projectFixture.createPersonal(user, 80)
    const high = await this.projectFixture.createPersonal(user, 200)

    low.title = 'low-rate'
    high.title = 'high-rate'
    await this.projectRepository.saveMany([low, high])

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: { rateHourTo: 100 },
        sort: { rateHour: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(1)
    expect(rows[0].id).to.be.eq(low.id)
  }

  @test()
  async search_filterRateHourFrom_only() {
    const user = await this.userFixture.createUser()
    const low = await this.projectFixture.createPersonal(user, 80)
    const high = await this.projectFixture.createPersonal(user, 200)

    await this.projectRepository.saveMany([low, high])

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: { rateHourFrom: 150 },
        sort: { rateHour: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(1)
    expect(rows[0].id).to.be.eq(high.id)
  }

  @test()
  async search_filterTrackProcesses_boolean() {
    const user = await this.userFixture.createUser()
    const withProc = await this.projectFixture.createPersonal(
      user,
      10,
      false,
      true,
    )
    const without = await this.projectFixture.createPersonal(
      user,
      10,
      false,
      false,
    )
    await this.projectRepository.saveMany([withProc, without])

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: { trackProcesses: true },
        sort: { title: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(1)
    expect(rows[0].id).to.be.eq(withProc.id)
  }

  @test()
  async search_sortCreatedAt_desc_putsNewestFirst() {
    const user = await this.userFixture.createUser()
    const first = await this.projectFixture.createPersonal(user)
    await new Promise((resolve) => setTimeout(resolve, 25))
    const second = await this.projectFixture.createPersonal(user)

    const res = await projectControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {},
        sort: { createdAt: 'DESC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string; createdAt: string }>
    expect(rows.length).to.be.eq(2)
    expect(rows[0].id).to.be.eq(second.id)
    expect(rows[1].id).to.be.eq(first.id)
  }

  @test()
  async search_rejectsInvalidStateInFilter() {
    const user = await this.userFixture.createUser()

    let error: unknown

    try {
      await projectControllerSearch({
        client: this.apiClient(),
        headers: {
          Authorization: this.authenticator.getTokens(user).accessToken,
        },
        body: {
          filter: { state: 'NotARealState' as never },
          sort: { createdAt: 'ASC' },
          page: 0,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(400)
  }

  @test()
  async search_rejectsInvalidPageType() {
    const user = await this.userFixture.createUser()

    let error: unknown

    try {
      await projectControllerSearch({
        client: this.apiClient(),
        headers: {
          Authorization: this.authenticator.getTokens(user).accessToken,
        },
        body: {
          filter: {},
          sort: { createdAt: 'ASC' },
          page: '0' as never,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(400)
  }

  @test()
  async search_rejectsInvalidSortDirection() {
    const user = await this.userFixture.createUser()
    let error: unknown

    try {
      await projectControllerSearch({
        client: this.apiClient(),
        headers: {
          Authorization: this.authenticator.getTokens(user).accessToken,
        },
        body: {
          filter: {},
          sort: { createdAt: 'DOWN' as never },
          page: 0,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(400)
  }

  @test()
  async search_rejectsMissingPageField() {
    const user = await this.userFixture.createUser()
    let error: unknown

    try {
      await projectControllerSearch({
        client: this.apiClient(),
        headers: {
          Authorization: this.authenticator.getTokens(user).accessToken,
        },
        body: {
          filter: {},
          sort: { createdAt: 'ASC' },
        } as never,
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(400)
  }

  @test()
  async search_requiresAuthorization() {
    let error: unknown

    try {
      await projectControllerSearch({
        client: this.apiClient(),
        body: {
          filter: {},
          sort: { createdAt: 'DESC' },
          page: 0,
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
