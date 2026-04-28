import { expect } from 'chai'
import { suite, test } from '@testdeck/mocha'
import moment from 'moment'

import { BaseControllerTest } from './base-controller.test'
import { EProjectState } from '../../interface/project'
import { TimeRepository } from '../../repository/time-repository'
import { ProjectRepository } from '../../repository/project-repository'
import { RedisClient } from '../../service/redis-client'

@suite
export class TimeControllerTest extends BaseControllerTest {
  protected timeRepository: TimeRepository
  protected projectRepository: ProjectRepository
  protected redisClient: RedisClient

  constructor() {
    super()

    this.timeRepository = this.container.get('TimeRepository')
    this.projectRepository = this.container.get('ProjectRepository')
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

    const res = await this.http.request({
      url: `${this.url}/api/time/${time.id}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
    })

    expect(res.status).to.be.equal(200)
    expect(res.data.id).to.be.equal(time.id)
    expect(res.data.project.id).to.be.equal(project.id)
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

    let res = null

    try {
      res = await this.http.request({
        url: `${this.url}/api/time/${time.id}`,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.authenticator.getTokens(other).accessToken,
        },
      })
    } catch (error: any) {
      res = error.response
    }

    expect(res.status).to.be.equal(401)
  }

  @test
  async searchPersonal() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )

    const res = await this.http.request({
      url: `${this.url}/api/time/search`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      data: {
        filter: {},
        sort: { createdAt: 'ASC' },
        page: 0,
      },
    })

    expect(res.status).to.be.equal(200)
    expect(res.data[0].length).to.be.eq(1)
    expect(res.data[0][0].id).to.be.eq(time.id)
    expect(res.data[0][0].note).to.be.deep.eq(time.note)
  }

  @test
  async searchPersonalById() {
    const user = await this.userFixture.createUser()
    const projectA = await this.projectFixture.createPersonal(user)
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

    const res = await this.http.request({
      url: `${this.url}/api/time/search`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      data: {
        filter: {
          projectId: projectA.id,
        },
        sort: { createdAt: 'DESC' },
        page: 0,
      },
    })

    expect(res.status).to.be.equal(200)
    expect(res.data[0].length).to.be.eq(1)
    expect(res.data[0][0].id).to.be.eq(timeA.id)
    expect(res.data[0][0].note).to.be.deep.eq(timeA.note)
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

    const res = await this.http.request({
      url: `${this.url}/api/time/totals`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
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

    const res = await this.http.request({
      url: `${this.url}/api/time/totals?projectId=${projectA.id}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
    })

    expect(res.status).to.be.equal(200)
    expect(res.data[0].projectId).to.be.eq(projectA.id)
    expect(res.data[0].rateHour).to.be.eq(projectA.rateHour)
    expect(res.data[0].rateTotal).to.be.eq(10)
    expect(res.data[0].minutes).to.be.eq(10)
    expect(res.data[0].minutesActive).to.be.eq(timeA.minutesActive)
    expect(res.data[0].mouseKeys).to.be.eq(timeA.mouseKeys)
    expect(res.data[0].keyboardKeys).to.be.eq(timeA.keyboardKeys)
    expect(res.data[0].mouseDistance).to.be.eq(timeA.mouseDistance)
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

    const res = await this.http.request({
      url: `${this.url}/api/time/report/${project.id}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
    })

    const cacheFull = await this.redisClient.get(project.id)

    expect(res.status).to.be.equal(200)
    expect(res.data.totals[0].projectId).to.be.eq(project.id)
    expect(res.data.time).to.be.length(2)
    expect(res.data.time[0].id).to.be.eq(timeB.id)
    expect(res.data.time[1].id).to.be.eq(timeA.id)
    expect(cacheEmpty).to.be.length(0)
    expect(cacheFull.totals[0].projectId).to.be.eq(project.id)
    expect(cacheFull.time).to.be.length(2)
  }

  @test
  async getReportEmpty() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)

    const cacheEmpty = await this.redisClient.get(project.id)

    const res = await this.http.request({
      url: `${this.url}/api/time/report/${project.id}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
    })

    const cacheFull = await this.redisClient.get(project.id)

    expect(res.status).to.be.equal(200)
    expect(res.data).to.be.deep.eq({ totals: [], time: [] })
    expect(cacheEmpty).to.be.length(0)
    expect(cacheFull).to.be.deep.eq({ totals: [], time: [] })
  }
}
