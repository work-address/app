import { expect } from 'chai'
import axios from 'axios'
import moment from 'moment'
import { suite, test } from '@testdeck/mocha'

import {
  invoiceControllerCreate,
  invoiceControllerRead,
  invoiceControllerSearch,
  projectControllerEdit,
  projectControllerGetStats,
  projectControllerRead,
  projectControllerSearch,
} from '@app/api-client'
import {
  timeControllerCreateOrUpdateMany,
  timeControllerEdit,
  timeControllerGetTotals,
  timeControllerRead as timeControllerReadEntry,
  timeControllerSearch,
} from '@app/api-client'
import type { TimeCreateDto as ApiTimeCreateDto } from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeRepository } from '@/repository/time-repository'
import { EProjectState } from '@/model/project'
import { EProjectStatisticsPeriod } from '@/model/project-statistics'
import { User } from '@/entity/user'
import { Project } from '@/entity/project'
import { runPromise } from '@/service/effect-bridge'

@suite
export class ProjectControllerSharedAccessTest extends BaseControllerTest {
  protected projectRepository: ProjectRepository

  constructor() {
    super()
    this.projectRepository = this.container.get('ProjectRepository')
  }

  private token(user: User): string {
    return this.authenticator.getTokens(user).accessToken
  }

  private async grantAccess(
    project: Project,
    owner: User,
    worker: User,
    viewer: User,
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
        workerAddresses: [worker.address],
        viewerAddresses: [viewer.address],
      },
      throwOnError: true,
    })
  }

  @test
  async workerCanTrackTimeOnSharedProject() {
    const owner = await this.userFixture.createPremiumUser()
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
        Authorization: this.authenticator.getTokens(worker).accessToken,
      },
      body: [
        {
          fromIndex: 1000,
          toIndex: 1001,
          note: 'worker entry',
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
    expect(res.data[0]).to.not.have.property('error')
    expect(res.data[0]).to.have.property('id')
  }

  /**
   * The whole collaboration loop on the hosted service with an owner who
   * never paid: collaborators are free, and a viewer sees work but no money.
   * This is the marketplace case too - the client who hires is usually on
   * the free plan, and the freelancer must still record and invoice.
   */
  @test
  async freeOwner_workerRecordsAndInvoices_viewerSeesWorkButNoInvoices() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)

    const granted = await this.grantAccess(project, owner, worker, viewer)
    const stored = await runPromise(
      this.projectRepository.findOneByIdOrFail(project.id),
    )

    expect(this.parameters.entitlementSecret).to.not.equal('')
    expect(owner.premium).to.not.be.ok
    expect(granted.status).to.be.equal(200)
    expect(stored.workerAddresses).to.deep.equal([worker.address])
    expect(stored.viewerAddresses).to.deep.equal([viewer.address])

    // The worker finds the project and records time on it.
    const workerSearch = await projectControllerSearch({
      client: this.apiClient(),
      headers: { Authorization: this.token(worker) },
      body: { filter: {}, sort: { createdAt: 'ASC' }, page: 0 },
      throwOnError: true,
    })
    const fromAt = moment.utc().subtract(40, 'minutes')
    const toAt = moment.utc().subtract(10, 'minutes')
    const tracked = await timeControllerCreateOrUpdateMany({
      client: this.apiClient(),
      headers: { Authorization: this.token(worker) },
      body: [
        {
          fromIndex: 1000,
          toIndex: 1001,
          note: 'worker entry',
          keyboardKeys: 1,
          minutesActive: 30,
          mouseKeys: 1,
          mouseDistance: 1,
          fromAt: fromAt.toISOString(),
          toAt: toAt.toISOString(),
          projectId: project.id,
        },
      ] as ApiTimeCreateDto[],
      throwOnError: true,
    })

    expect(
      (workerSearch.data[0] as Array<{ id: string }>).map((row) => row.id),
    ).to.include(project.id)
    expect(tracked.data[0]).to.not.have.property('error')
    expect(tracked.data[0]).to.have.property('id')

    // ...and invoices it: everything outstanding, 30 minutes at $60.
    const invoiced = await invoiceControllerCreate({
      client: this.apiClient(),
      path: { projectId: project.id as never },
      headers: { Authorization: this.token(worker) },
      body: {},
      throwOnError: true,
    })

    expect(invoiced.status).to.be.equal(200)
    expect(invoiced.data?.amountCents).to.be.equal(3000)

    // The viewer sees the project, its time and its statistics...
    const viewerRead = await projectControllerRead({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: { Authorization: this.token(viewer) },
      throwOnError: true,
    })
    const viewerTime = await timeControllerSearch({
      client: this.apiClient(),
      headers: { Authorization: this.token(viewer) },
      body: {
        filter: { projectId: project.id },
        sort: { createdAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })
    const viewerStats = await projectControllerGetStats({
      client: this.apiClient(),
      path: {
        id: project.id as never,
        period: EProjectStatisticsPeriod.ONE_DAY,
      },
      headers: { Authorization: this.token(viewer) },
      throwOnError: true,
    })

    expect(viewerRead.status).to.be.equal(200)
    expect(viewerRead.data.id).to.be.equal(project.id)
    expect((viewerTime.data[0] as unknown[]).length).to.be.equal(1)
    expect(viewerStats.status).to.be.equal(200)

    // ...but no invoice, by search or by id.
    const viewerInvoices = await invoiceControllerSearch({
      client: this.apiClient(),
      headers: { Authorization: this.token(viewer) },
      body: {
        filter: { projectId: project.id },
        sort: { createdAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect((viewerInvoices.data[0] as unknown[]).length).to.be.equal(0)
    expect(viewerInvoices.data[1]).to.be.equal(0)

    let error: unknown

    try {
      await invoiceControllerRead({
        client: this.apiClient(),
        path: { id: invoiced.data?.id as never },
        headers: { Authorization: this.token(viewer) },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(403)
  }

  @test
  async workerCannotEditTimeEntry() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    await this.grantAccess(project, owner, worker, viewer)

    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )

    let error: unknown

    try {
      await timeControllerEdit({
        client: this.apiClient(),
        path: { id: time.id as never },
        headers: {
          Authorization: this.authenticator.getTokens(worker).accessToken,
        },
        body: { note: 'worker edit attempt', isPaid: true },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(403)
  }

  @test
  async workerCanEditOwnTimeEntry() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    await this.grantAccess(project, owner, worker, viewer)

    const fromAt = moment.utc().subtract(10, 'minutes').toISOString()
    const toAt = moment.utc().toISOString()
    const created = await timeControllerCreateOrUpdateMany({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(worker).accessToken,
      },
      body: [
        {
          fromIndex: 1000,
          toIndex: 1001,
          note: 'worker entry',
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

    const timeId = (created.data[0] as { id: string }).id

    const res = await timeControllerEdit({
      client: this.apiClient(),
      path: { id: timeId as never },
      headers: {
        Authorization: this.authenticator.getTokens(worker).accessToken,
      },
      body: { note: 'worker edit', isPaid: true },
      throwOnError: true,
    })

    const updated = await runPromise(
      this.container.get<TimeRepository>('TimeRepository').findOneBy({
        where: { id: timeId },
      }),
    )

    expect(res.status).to.be.equal(200)
    expect(updated!.isPaid).to.be.true
  }

  @test
  async viewerCanReadTimeSearchAndTotals() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    await this.grantAccess(project, owner, worker, viewer)

    const fromAt = moment.utc().subtract(60, 'minutes').toDate()
    const toAt = moment.utc().toDate()
    const time = await this.timeFixture.create(project, fromAt, toAt)

    const searchRes = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(viewer).accessToken,
      },
      body: {
        filter: { projectId: project.id },
        sort: { createdAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    const readRes = await timeControllerReadEntry({
      client: this.apiClient(),
      path: { id: time.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(viewer).accessToken,
      },
      throwOnError: true,
    })

    const totalsRes = await timeControllerGetTotals({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(viewer).accessToken,
      },
      throwOnError: true,
    })

    expect((searchRes.data[0] as Array<{ id: string }>).length).to.be.eq(1)
    expect(readRes.data.id).to.be.equal(time.id)
    expect(totalsRes.data).to.have.length(1)
  }

  @test
  async ownerCanReadTotals() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    await this.grantAccess(project, owner, worker, viewer)

    const fromAt = moment.utc().subtract(60, 'minutes').toDate()
    const toAt = moment.utc().toDate()
    await this.timeFixture.create(project, fromAt, toAt)

    const totalsRes = await timeControllerGetTotals({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      throwOnError: true,
    })

    expect(totalsRes.data).to.have.length(1)
  }

  @test
  async workerCanReadTotals() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    await this.grantAccess(project, owner, worker, viewer)

    const fromAt = moment.utc().subtract(60, 'minutes').toDate()
    const toAt = moment.utc().toDate()
    await this.timeFixture.create(project, fromAt, toAt)

    const totalsRes = await timeControllerGetTotals({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(worker).accessToken,
      },
      throwOnError: true,
    })

    expect(totalsRes.data).to.have.length(1)
  }

  @test
  async viewerCanReadTotalsWithProjectIdFilter() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    await this.grantAccess(project, owner, worker, viewer)
    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )

    const res = await timeControllerGetTotals({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(viewer).accessToken,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data.length).to.be.eq(1)
    const row = res.data[0] as Record<string, unknown>
    expect(row.projectId).to.be.eq(project.id)
    expect(row.minutesActive).to.be.eq(time.minutesActive)
  }

  @test
  async viewerCanReadProjectStats() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(
      owner,
      0,
      false,
      true,
    )
    await this.grantAccess(project, owner, worker, viewer)

    const res = await projectControllerGetStats({
      client: this.apiClient(),
      path: {
        id: project.id as never,
        period: EProjectStatisticsPeriod.ONE_DAY,
      },
      headers: {
        Authorization: this.authenticator.getTokens(viewer).accessToken,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data).to.be.an('array')
  }

  @test
  async unrelatedUserStillDeniedForProjectRead() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const other = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    await this.grantAccess(project, owner, worker, viewer)

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
    expect(error.response?.status).to.be.equal(404)
  }

  @test
  async unrelatedUserDeniedForTimeSearch() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const other = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    await this.grantAccess(project, owner, worker, viewer)
    await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )

    const res = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(other).accessToken,
      },
      body: {
        filter: { projectId: project.id },
        sort: { createdAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect((res.data[0] as unknown[]).length).to.be.eq(0)
    expect(res.data[1]).to.be.eq(0)
  }
}
