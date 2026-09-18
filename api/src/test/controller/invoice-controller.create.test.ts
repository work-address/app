import { expect } from 'chai'
import axios from 'axios'
import { faker } from '@faker-js/faker'
import moment from 'moment'
import { suite, test } from '@testdeck/mocha'

import { invoiceControllerCreate } from '@app/api-client'

import { App } from '@/app/app'
import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { ConcurrentCalls } from '@/test/fixture/concurrent-calls'
import { Invoice } from '@/entity/invoice'
import { Project } from '@/entity/project'
import { User } from '@/entity/user'
import { EProjectState } from '@/model/project'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeRepository } from '@/repository/time-repository'
import { runPromise } from '@/service/effect-bridge'

@suite
export class InvoiceControllerCreateTest extends BaseControllerTest {
  protected projectRepository: ProjectRepository
  protected timeRepository: TimeRepository

  constructor() {
    super()
    this.projectRepository = this.container.get('ProjectRepository')
    this.timeRepository = this.container.get('TimeRepository')
  }
  @test()
  async createFromLoggedTime() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    const fromAt = moment.utc().subtract(2, 'hours')
    const toAt = moment.utc().subtract(1, 'hour')
    const time = await this.timeFixture.create(
      project,
      fromAt.toDate(),
      toAt.toDate(),
    )

    const res = await invoiceControllerCreate({
      client: this.apiClient(),
      path: { projectId: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        fromUnix: fromAt.valueOf(),
        toUnix: toAt.valueOf(),
      },
      throwOnError: true,
    })

    const expectedHours = (time.minutesActive || 0) / 60
    const expectedCents = Math.round(60 * expectedHours * 100)

    expect(res.status).to.be.equal(200)
    expect(res.data.amountCents).to.be.equal(expectedCents)
    expect(res.data.state).to.be.equal('Requested')
    expect(res.data.project?.id).to.be.equal(project.id)
  }

  @test()
  /**
   * A zero-amount invoice would sit in the ledger looking like a settled debt
   * that never existed, so an empty range is refused instead of created.
   */
  async create_refusesAnEmptyRange() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)

    let error: unknown

    try {
      await invoiceControllerCreate({
        client: this.apiClient(),
        path: { projectId: project.id as never },
        headers: {
          Authorization: this.authenticator.getTokens(owner).accessToken,
        },
        body: {
          fromUnix: moment.utc().subtract(1, 'day').valueOf(),
          toUnix: moment.utc().subtract(23, 'hours').valueOf(),
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
  async create_deniedForNonOwner() {
    const owner = await this.userFixture.createUser()
    const other = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    let error: unknown

    try {
      await invoiceControllerCreate({
        client: this.apiClient(),
        path: { projectId: project.id as never },
        headers: {
          Authorization: this.authenticator.getTokens(other).accessToken,
        },
        body: {
          fromUnix: moment.utc().subtract(1, 'day').valueOf(),
          toUnix: moment.utc().valueOf(),
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(403)
    expect(error.response?.data.name).to.be.equal('UserAccessException')
  }

  @test()
  /**
   * The owner here is on the free plan, and collaborators are free: the
   * worker invoices their own hours through the API like any other worker.
   */
  async create_letsAWorkerOnAFreeOwnersProjectInvoice() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    project.workerAddresses = [worker.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const fromAt = moment.utc().subtract(2, 'hours')
    const toAt = moment.utc().subtract(1, 'hour')
    const time = await this.timeFixture.create(
      project,
      fromAt.toDate(),
      toAt.toDate(),
      worker,
    )
    time.minutesActive = 30
    await runPromise(this.timeRepository.saveSingle(time))

    const res = await invoiceControllerCreate({
      client: this.apiClient(),
      path: { projectId: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(worker).accessToken,
      },
      body: {
        fromUnix: fromAt.valueOf(),
        toUnix: toAt.valueOf(),
      },
      throwOnError: true,
    })

    expect(owner.premium).to.not.be.ok
    expect(res.status).to.be.equal(200)
    expect(res.data.amountCents).to.be.equal(3000)
    expect(res.data.project?.id).to.be.equal(project.id)
  }

  @test()
  /**
   * One invoice, one issuer. Summing every contributor's hours into the
   * owner's invoice billed for work that was not theirs and left the worker
   * with no record of their own.
   */
  async create_coversOnlyTheIssuersOwnTime() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    project.workerAddresses = [worker.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const fromAt = moment.utc().subtract(3, 'hours')
    const toAt = moment.utc().subtract(1, 'hour')

    const ownerTime = await this.timeFixture.create(
      project,
      fromAt.toDate(),
      fromAt.clone().add(1, 'hour').toDate(),
      owner,
    )
    ownerTime.minutesActive = 60
    await runPromise(this.timeRepository.saveSingle(ownerTime))

    const workerTime = await this.timeFixture.create(
      project,
      fromAt.clone().add(1, 'hour').toDate(),
      toAt.toDate(),
      worker,
    )
    workerTime.minutesActive = 30
    await runPromise(this.timeRepository.saveSingle(workerTime))

    const res = await invoiceControllerCreate({
      client: this.apiClient(),
      path: { projectId: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {
        fromUnix: fromAt.valueOf(),
        toUnix: toAt.valueOf(),
      },
      throwOnError: true,
    })

    // The owner's own hour at $60 = 6000 cents, not the worker's half-hour on
    // the same project.
    expect(res.status).to.be.equal(200)
    expect(res.data.amountCents).to.be.equal(6000)
  }

  @test()
  async create_unknownProject_notFound() {
    const owner = await this.userFixture.createUser()

    let error: unknown

    try {
      await invoiceControllerCreate({
        client: this.apiClient(),
        path: { projectId: faker.string.uuid() as never },
        headers: {
          Authorization: this.authenticator.getTokens(owner).accessToken,
        },
        body: {
          fromUnix: moment.utc().subtract(1, 'day').valueOf(),
          toUnix: moment.utc().valueOf(),
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
  async create_requiresAuthorization() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    let error: unknown

    try {
      await invoiceControllerCreate({
        client: this.apiClient(),
        path: { projectId: project.id as never },
        body: {
          fromUnix: moment.utc().subtract(1, 'day').valueOf(),
          toUnix: moment.utc().valueOf(),
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(401)
  }

  /**
   * The same route serves both shapes: an explicit range bills that period,
   * an absent one bills everything outstanding. Keeping them on one endpoint
   * means there is a single place that decides who may invoice a project.
   */
  @test()
  async create_withoutARange_billsEverythingOutstanding() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    const fromAt = moment.utc().subtract(3, 'hours')

    const time = await this.timeFixture.create(
      project,
      fromAt.toDate(),
      fromAt.clone().add(1, 'hour').toDate(),
      owner,
    )
    time.minutesActive = 60
    await runPromise(this.timeRepository.saveSingle(time))

    const res = await invoiceControllerCreate({
      client: this.apiClient(),
      path: { projectId: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      body: {},
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data.amountCents).to.be.equal(6000)
  }

  /** And it stays idempotent through the shared route. */
  @test()
  async create_withoutARange_isIdempotent() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    const fromAt = moment.utc().subtract(3, 'hours')

    const time = await this.timeFixture.create(
      project,
      fromAt.toDate(),
      fromAt.clone().add(1, 'hour').toDate(),
      owner,
    )
    time.minutesActive = 60
    await runPromise(this.timeRepository.saveSingle(time))

    const call = () =>
      invoiceControllerCreate({
        client: this.apiClient(),
        path: { projectId: project.id as never },
        headers: {
          Authorization: this.authenticator.getTokens(owner).accessToken,
        },
        body: {},
        throwOnError: true,
      })

    const first = await call()
    const second = await call()

    expect(second.data.id).to.be.equal(first.data.id)
  }

  private async hourOfWork(project: Project, owner: User) {
    const fromAt = moment.utc().subtract(3, 'hours')
    const time = await this.timeFixture.create(
      project,
      fromAt.toDate(),
      fromAt.clone().add(1, 'hour').toDate(),
      owner,
    )
    time.minutesActive = 60

    return runPromise(this.timeRepository.saveSingle(time))
  }

  /**
   * A double click sends the default request twice at once. Both must come
   * back with the same invoice, and only one may exist.
   */
  @test()
  async create_withoutARange_inParallel_raisesOneInvoice() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    await this.hourOfWork(project, owner)

    const settled = await new ConcurrentCalls(App.conn).settle(
      [1, 2, 3].map(
        () => () =>
          invoiceControllerCreate({
            client: this.apiClient(),
            path: { projectId: project.id as never },
            headers: {
              Authorization: this.authenticator.getTokens(owner).accessToken,
            },
            body: {},
            throwOnError: true,
          }),
      ),
    )
    const responses = settled.map((result) => {
      if (result.status === 'rejected') throw result.reason
      return result.value
    })

    expect(new Set(responses.map((res) => res.data.id)).size).to.be.equal(1)
    expect(await App.conn.getRepository(Invoice).count()).to.be.equal(1)
    expect(responses[0].data.amountCents).to.be.equal(6000)
  }
}
