import { expect } from 'chai'
import axios from 'axios'
import { suite, test } from '@testdeck/mocha'
import moment from 'moment'
import { faker } from '@faker-js/faker'

import {
  projectControllerEdit,
  timeControllerGetReport,
  timeControllerGetTotals,
  timeControllerRead,
} from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { EProjectState } from '@/model/project'
import { RedisClient } from '@/service/redis-client'
import { TimeRepository } from '@/repository/time-repository'

@suite
export class TimeControllerTest extends BaseControllerTest {
  protected redisClient: RedisClient
  protected timeRepository: TimeRepository

  constructor() {
    super()

    this.redisClient = this.container.get('RedisClient')
    this.timeRepository = this.container.get('TimeRepository')
  }

  @test
  async getTimePublishedAsOwner() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )

    const client = this.apiClient()
    const res = await timeControllerRead({
      client,
      path: { id: time.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const responseTime = res.data as {
      id?: string
      note?: string
      isPaid?: boolean
      fromAt?: string
      toAt?: string
      minutesActive?: number
      keyboardKeys?: number
      mouseKeys?: number
      mouseDistance?: number
      project?: { id?: string; title?: string; state?: EProjectState }
    }
    expect(responseTime.id).to.be.equal(time.id)
    expect(responseTime.note).to.be.equal(time.note)
    expect(responseTime.isPaid).to.be.false
    expect(new Date(responseTime.fromAt as string).toISOString()).to.be.equal(
      time.fromAt.toISOString(),
    )
    expect(new Date(responseTime.toAt as string).toISOString()).to.be.equal(
      time.toAt.toISOString(),
    )
    expect(responseTime.minutesActive).to.be.equal(time.minutesActive)
    expect(responseTime.keyboardKeys).to.be.equal(time.keyboardKeys)
    expect(responseTime.mouseKeys).to.be.equal(time.mouseKeys)
    expect(responseTime.mouseDistance).to.be.equal(time.mouseDistance)
    const responseProject = responseTime.project ?? {}
    expect(responseProject.id).to.be.equal(project.id)
    expect(responseProject.title).to.be.equal(project.title)
    expect(responseProject.state).to.be.equal(project.state)
  }

  @test
  async read_returnsIsPaidWhenSet() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )
    time.isPaid = true
    await this.container.get<TimeRepository>('TimeRepository').saveSingle(time)

    const res = await timeControllerRead({
      client: this.apiClient(),
      path: { id: time.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect((res.data as { isPaid?: boolean }).isPaid).to.be.true
  }

  @test
  async getTimeAsNonProjectOwnerDenied() {
    const owner = await this.userFixture.createPremiumUser()
    const other = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )

    let error: unknown

    try {
      await timeControllerRead({
        client: this.apiClient(),
        path: { id: time.id as never },
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
    expect(error.response?.status).to.be.equal(403)
  }

  @test
  async getTotals() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user, 30)
    await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )

    const res = await timeControllerGetTotals({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data.length).to.be.eq(1)
  }

  @test
  async getTotalsProject() {
    const user = await this.userFixture.createUser()
    const projectA = await this.projectFixture.createPersonal(user, 60)
    const projectB = await this.projectFixture.createPersonal(user)
    const timeA = await this.timeFixture.create(
      projectA,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )
    await this.timeFixture.create(
      projectB,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )

    const client = this.apiClient()
    const res = await timeControllerGetTotals({
      client,
      path: { id: projectA.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data.length).to.be.eq(1)

    const row = res.data[0] as Record<string, unknown>
    expect(row.projectId).to.be.eq(projectA.id)
    expect(row.rateHour).to.be.eq(projectA.rateHour)
    expect(row.rateTotal).to.be.eq(10)
    expect(row.minutes).to.be.eq(10)
    expect(row.minutesActive).to.be.eq(timeA.minutesActive)
    expect(row.mouseKeys).to.be.eq(timeA.mouseKeys)
    expect(row.keyboardKeys).to.be.eq(timeA.keyboardKeys)
    expect(row.mouseDistance).to.be.eq(timeA.mouseDistance)
  }

  @test
  async getTotalsAsWorker() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)

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

    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )

    const res = await timeControllerGetTotals({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(worker).accessToken,
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
  async getTotals_unpaidTimeOnly() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user, 60)
    const fromAt = moment.utc().subtract(2, 'hours')
    const toAt = moment.utc().subtract(1, 'hour')

    const unpaidTime = await this.timeFixture.create(
      project,
      fromAt.toDate(),
      toAt.toDate(),
      user,
    )
    unpaidTime.minutesActive = 45
    await this.timeRepository.saveSingle(unpaidTime)

    const res = await timeControllerGetTotals({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      throwOnError: true,
    })

    const row = res.data[0] as Record<string, unknown>
    expect(row.minutesActive).to.be.eq(45)
    expect(row.minutesPaid).to.be.eq(0)
    expect(row.minutesUnpaid).to.be.eq(45)
  }

  @test
  async getTotals_paidTimeOnly() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user, 60)
    const fromAt = moment.utc().subtract(2, 'hours')
    const toAt = moment.utc().subtract(1, 'hour')

    const paidTime = await this.timeFixture.create(
      project,
      fromAt.toDate(),
      toAt.toDate(),
      user,
    )
    paidTime.minutesActive = 30
    paidTime.isPaid = true
    await this.timeRepository.saveSingle(paidTime)

    const res = await timeControllerGetTotals({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      throwOnError: true,
    })

    const row = res.data[0] as Record<string, unknown>
    expect(row.minutesActive).to.be.eq(30)
    expect(row.minutesPaid).to.be.eq(30)
    expect(row.minutesUnpaid).to.be.eq(0)
  }

  @test
  async getTotals_mixedPaidAndUnpaidTime() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user, 60)
    const fromAt = moment.utc().subtract(3, 'hours')
    const midAt = moment.utc().subtract(2, 'hours')
    const toAt = moment.utc().subtract(1, 'hour')

    const unpaidTime = await this.timeFixture.create(
      project,
      fromAt.toDate(),
      midAt.toDate(),
      user,
    )
    unpaidTime.minutesActive = 40
    await this.timeRepository.saveSingle(unpaidTime)

    const paidTime = await this.timeFixture.create(
      project,
      midAt.toDate(),
      toAt.toDate(),
      user,
    )
    paidTime.minutesActive = 25
    paidTime.isPaid = true
    await this.timeRepository.saveSingle(paidTime)

    const res = await timeControllerGetTotals({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      throwOnError: true,
    })

    const row = res.data[0] as Record<string, unknown>
    expect(row.minutesActive).to.be.eq(65)
    expect(row.minutesPaid).to.be.eq(25)
    expect(row.minutesUnpaid).to.be.eq(40)
  }

  @test
  async getTotals_deniedForUnrelatedUserWithProjectId() {
    const owner = await this.userFixture.createPremiumUser()
    const other = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)

    let error: unknown

    try {
      await timeControllerGetTotals({
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
    expect(error.response?.status).to.be.equal(403)
  }

  @test
  async getReport() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const timeA = await this.timeFixture.create(
      project,
      moment.utc().subtract(120, 'minutes').toDate(),
      moment.utc().subtract(110, 'minutes').toDate(),
    )
    const timeB = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().subtract(50, 'minutes').toDate(),
    )

    const cacheEmpty = await this.redisClient.get(project.id)

    const client = this.apiClient()
    const res = await timeControllerGetReport({
      client,
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      throwOnError: true,
    })

    const cacheFullRaw = await this.redisClient.get(project.id)
    const cacheFull = cacheFullRaw as {
      totals: { projectId: string }[]
      time: unknown[]
    }

    const report = res.data as unknown as {
      totals: Array<{ projectId: string }>
      time: Array<{ id: string }>
    }

    expect(res.status).to.be.equal(200)
    expect(report.totals[0].projectId).to.be.eq(project.id)
    expect(report.time).to.be.length(2)
    expect(report.time[0].id).to.be.eq(timeB.id)
    expect(report.time[1].id).to.be.eq(timeA.id)
    expect(cacheEmpty).to.be.length(0)
    expect(cacheFull.totals[0].projectId).to.be.eq(project.id)
    expect(cacheFull.time).to.be.length(2)
  }

  @test
  async read_requiresAuthorization() {
    let error: unknown

    try {
      await timeControllerRead({
        client: this.apiClient(),
        path: { id: faker.string.uuid() as never },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(401)
  }

  @test
  async getTotals_requiresAuthorization() {
    let error: unknown

    try {
      await timeControllerGetTotals({
        client: this.apiClient(),
        path: { id: faker.string.uuid() as never },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(401)
  }

  @test
  async getReport_requiresAuthorization() {
    let error: unknown

    try {
      await timeControllerGetReport({
        client: this.apiClient(),
        path: { id: faker.string.uuid() as never },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(401)
  }

  @test
  async getReport_unknownProject_notFound() {
    const user = await this.userFixture.createUser()

    let error: unknown

    try {
      await timeControllerGetReport({
        client: this.apiClient(),
        path: { id: faker.string.uuid() as never },
        headers: {
          Authorization: this.authenticator.getTokens(user).accessToken,
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
  async read_unknownTime_notFound() {
    const owner = await this.userFixture.createPremiumUser()

    let error: unknown

    try {
      await timeControllerRead({
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

  @test
  async getReport_deniedForUnrelatedUser() {
    const owner = await this.userFixture.createPremiumUser()
    const other = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner)

    let error: unknown

    try {
      await timeControllerGetReport({
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
    expect(error.response?.status).to.be.equal(403)
  }

  @test
  async getReportEmpty() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)

    const cacheEmpty = await this.redisClient.get(project.id)

    const client = this.apiClient()
    const res = await timeControllerGetReport({
      client,
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      throwOnError: true,
    })

    const cacheFull = await this.redisClient.get(project.id)

    expect(res.status).to.be.equal(200)
    expect(res.data).to.be.deep.eq({ totals: [], time: [] })
    expect(cacheEmpty).to.be.length(0)
    expect(cacheFull).to.be.deep.eq({ totals: [], time: [] })
  }
}
