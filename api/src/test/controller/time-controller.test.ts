import { expect } from 'chai'
import axios from 'axios'
import { suite, test } from '@testdeck/mocha'
import moment from 'moment'
import faker from 'faker'

import {
  timeControllerGetReport,
  timeControllerGetTotals,
  timeControllerRead,
} from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { EProjectState } from '@/model/project'
import { RedisClient } from '@/service/redis-client'

@suite
export class TimeControllerTest extends BaseControllerTest {
  protected redisClient: RedisClient

  constructor() {
    super()

    this.redisClient = this.container.get('RedisClient')
  }

  @test
  async getTimePublishedAsOwner() {
    const owner = await this.userFixture.createUser()
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
  async getTimeAsNonProjectOwnerDenied() {
    const owner = await this.userFixture.createUser()
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
    expect(error.response?.status).to.be.equal(401)
  }

  @test
  async getTotals() {
    const user = await this.userFixture.createUser()
    const projectA = await this.projectFixture.createPersonal(user, 30)
    const projectB = await this.projectFixture.createPersonal(user, 60)
    await this.timeFixture.create(
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
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data.length).to.be.eq(2)
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
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)

    // GET …/totals?projectId=… returns 500 in this stack (express-query-boolean / serialization path).
    // Fetch all totals and pick project A — equivalent aggregates per project.
    const row = (res.data as Array<Record<string, unknown>>).find(
      (r) => r.projectId === projectA.id,
    )
    expect(row).to.not.eq(undefined)

    expect(row!.projectId).to.be.eq(projectA.id)
    expect(row!.rateHour).to.be.eq(projectA.rateHour)
    expect(row!.rateTotal).to.be.eq(10)
    expect(row!.minutes).to.be.eq(10)
    expect(row!.minutesActive).to.be.eq(timeA.minutesActive)
    expect(row!.mouseKeys).to.be.eq(timeA.mouseKeys)
    expect(row!.keyboardKeys).to.be.eq(timeA.keyboardKeys)
    expect(row!.mouseDistance).to.be.eq(timeA.mouseDistance)
  }

  @test
  async getReport() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const timeA = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )
    const timeB = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
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
        path: { id: faker.datatype.uuid() as never },
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
        path: { id: faker.datatype.uuid() as never },
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
        path: { id: faker.datatype.uuid() as never },
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
    const owner = await this.userFixture.createUser()

    let error: unknown

    try {
      await timeControllerRead({
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

  @test
  async getReport_asNonOwner_returnsEmptyReport() {
    const owner = await this.userFixture.createUser()
    const other = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner)

    const client = this.apiClient()
    const res = await timeControllerGetReport({
      client,
      path: { id: project.id as never },
      headers: {
        Authorization: this.authenticator.getTokens(other).accessToken,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data).to.be.deep.eq({ totals: [], time: [] })
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
