import { expect } from 'chai'
import axios from 'axios'
import { faker } from '@faker-js/faker'
import { suite, test } from '@testdeck/mocha'
import moment from 'moment'

import { timeControllerSearch } from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { TimeRepository } from '@/repository/time-repository'
import { ProjectRepository } from '@/repository/project-repository'

@suite
export class TimeControllerSearchTest extends BaseControllerTest {
  protected timeRepository: TimeRepository
  protected projectRepository: ProjectRepository

  constructor() {
    super()

    this.timeRepository = this.container.get('TimeRepository')
    this.projectRepository = this.container.get('ProjectRepository')
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

    const client = this.apiClient()
    const res = await timeControllerSearch({
      client,
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {},
        sort: { createdAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    const rowsPersonal = res.data[0] as Array<{
      id: string
      note: unknown
      isPaid: boolean
    }>
    expect(res.status).to.be.equal(200)
    expect(rowsPersonal.length).to.be.eq(1)
    expect(rowsPersonal[0].id).to.be.eq(time.id)
    expect(rowsPersonal[0].note).to.be.deep.eq(time.note)
    expect(rowsPersonal[0].isPaid).to.be.false
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

    const client = this.apiClient()
    const res = await timeControllerSearch({
      client,
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {
          projectId: projectA.id,
        },
        sort: { createdAt: 'DESC' },
        page: 0,
      },
      throwOnError: true,
    })

    const rowsById = res.data[0] as Array<{ id: string; note: unknown }>
    expect(res.status).to.be.equal(200)
    expect(rowsById.length).to.be.eq(1)
    expect(rowsById[0].id).to.be.eq(timeA.id)
    expect(rowsById[0].note).to.be.deep.eq(timeA.note)
  }

  @test
  async searchFiltersByAllAvailableFields() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const fromAt = moment.utc().subtract(120, 'minutes').toDate()
    const toAt = moment.utc().subtract(110, 'minutes').toDate()
    const match = await this.timeFixture.create(project, fromAt, toAt)
    const mismatch = await this.timeFixture.create(
      project,
      moment.utc().subtract(300, 'minutes').toDate(),
      moment.utc().subtract(290, 'minutes').toDate(),
    )

    match.note = 'focus billing block'
    match.screenshot = 'shot-billing-1'
    match.keyboardKeys = 150
    match.minutesActive = 7
    match.mouseKeys = 31
    match.mouseDistance = 80
    match.processes = [{ process: 'chrome', active: true }] as never

    mismatch.note = 'support queue'
    mismatch.screenshot = null
    mismatch.keyboardKeys = 1
    mismatch.minutesActive = 1
    mismatch.mouseKeys = 1
    mismatch.mouseDistance = 1
    mismatch.processes = []

    await this.timeRepository.saveMany([match, mismatch])

    const client = this.apiClient()
    const res = await timeControllerSearch({
      client,
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {
          projectId: project.id,
          fromAt: moment.utc(fromAt).subtract(1, 'minutes').toISOString(),
          toAt: moment.utc(toAt).add(1, 'minutes').toISOString(),
          note: 'billing',
          screenshot: 'shot-billing',
          keyboardKeysFrom: 100,
          keyboardKeysTo: 200,
          minutesActiveFrom: 5,
          minutesActiveTo: 10,
          mouseKeysFrom: 30,
          mouseKeysTo: 40,
          mouseDistanceFrom: 70,
          mouseDistanceTo: 90,
          withScreenshots: true,
          withProcesses: true,
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

  @test
  async searchReturnsEmptyWhenNoRowsMatch() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )

    const res = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {
          note: 'does-not-exist',
        },
        sort: { createdAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data[0]).to.be.deep.eq([])
    expect(res.data[1]).to.be.eq(0)
  }

  @test
  async searchRejectsInvalidFilterFieldType() {
    const user = await this.userFixture.createUser()

    let error: unknown

    try {
      await timeControllerSearch({
        client: this.apiClient(),
        headers: {
          Authorization: this.authenticator.getTokens(user).accessToken,
        },
        body: {
          filter: {
            keyboardKeysFrom: 'invalid' as never,
          },
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

  @test
  async search_sortByFromAt_desc_usesLatestWindowFirst() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const olderFrom = moment.utc().subtract(200, 'minutes').toDate()
    const olderTo = moment.utc().subtract(190, 'minutes').toDate()
    const newerFrom = moment.utc().subtract(50, 'minutes').toDate()
    const newerTo = moment.utc().subtract(40, 'minutes').toDate()

    const older = await this.timeFixture.create(project, olderFrom, olderTo)
    const newer = await this.timeFixture.create(project, newerFrom, newerTo)

    const res = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: { projectId: project.id },
        sort: { fromAt: 'DESC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(2)
    expect(rows[0].id).to.be.eq(newer.id)
    expect(rows[1].id).to.be.eq(older.id)
  }

  @test
  async search_sortByNote_asc_ordersByNoteText() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const now = moment.utc()

    const zEntry = await this.timeFixture.create(
      project,
      now.clone().subtract(120, 'minutes').toDate(),
      now.clone().subtract(110, 'minutes').toDate(),
    )
    zEntry.note = 'Z note'
    await this.timeRepository.saveSingle(zEntry)

    const aEntry = await this.timeFixture.create(
      project,
      now.clone().subtract(60, 'minutes').toDate(),
      now.clone().subtract(50, 'minutes').toDate(),
    )
    aEntry.note = 'A note'
    await this.timeRepository.saveSingle(aEntry)

    const res = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: { projectId: project.id },
        sort: { note: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(2)
    expect(rows[0].id).to.be.eq(aEntry.id)
    expect(rows[1].id).to.be.eq(zEntry.id)
  }

  @test
  async search_sortByProjectName_asc_ordersByProjectTitle() {
    const user = await this.userFixture.createUser()
    const zProject = await this.projectFixture.createPersonal(user)
    zProject.title = 'Z project'
    await this.projectRepository.saveSingle(zProject)

    const aProject = await this.projectFixture.createPersonal(user)
    aProject.title = 'A project'
    await this.projectRepository.saveSingle(aProject)

    const now = moment.utc()
    const zEntry = await this.timeFixture.create(
      zProject,
      now.clone().subtract(120, 'minutes').toDate(),
      now.clone().subtract(110, 'minutes').toDate(),
    )
    const aEntry = await this.timeFixture.create(
      aProject,
      now.clone().subtract(60, 'minutes').toDate(),
      now.clone().subtract(50, 'minutes').toDate(),
    )

    const res = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {},
        sort: { projectName: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(2)
    expect(rows[0].id).to.be.eq(aEntry.id)
    expect(rows[1].id).to.be.eq(zEntry.id)
  }

  @test
  async search_sortByPaidStatus_asc_ordersUnpaidFirst() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const now = moment.utc()

    const paidEntry = await this.timeFixture.create(
      project,
      now.clone().subtract(120, 'minutes').toDate(),
      now.clone().subtract(110, 'minutes').toDate(),
    )
    paidEntry.isPaid = true
    await this.timeRepository.saveSingle(paidEntry)

    const unpaidEntry = await this.timeFixture.create(
      project,
      now.clone().subtract(60, 'minutes').toDate(),
      now.clone().subtract(50, 'minutes').toDate(),
    )
    unpaidEntry.isPaid = false
    await this.timeRepository.saveSingle(unpaidEntry)

    const res = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: { projectId: project.id },
        sort: { paidStatus: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(2)
    expect(rows[0].id).to.be.eq(unpaidEntry.id)
    expect(rows[1].id).to.be.eq(paidEntry.id)
  }

  @test
  async search_sortByScreenshot_asc_ordersWithScreenshotFirst() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const now = moment.utc()

    // Postgres' default NULL ordering places NULLs last for ASC, so the
    // (non-null) screenshot value sorts before the row with none.
    const withScreenshot = await this.timeFixture.create(
      project,
      now.clone().subtract(120, 'minutes').toDate(),
      now.clone().subtract(110, 'minutes').toDate(),
    )
    withScreenshot.screenshot = faker.string.uuid()
    await this.timeRepository.saveSingle(withScreenshot)

    const withoutScreenshot = await this.timeFixture.create(
      project,
      now.clone().subtract(60, 'minutes').toDate(),
      now.clone().subtract(50, 'minutes').toDate(),
    )

    const res = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: { projectId: project.id },
        sort: { screenshot: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(2)
    expect(rows[0].id).to.be.eq(withScreenshot.id)
    expect(rows[1].id).to.be.eq(withoutScreenshot.id)
  }

  @test
  async search_pagination_limitAndSecondPage() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const base = moment.utc().subtract(500, 'minutes')
    const entries = await Promise.all(
      [0, 1, 2, 3].map((i) =>
        this.timeFixture.create(
          project,
          base
            .clone()
            .add(i * 10, 'minutes')
            .toDate(),
          base
            .clone()
            .add(i * 10 + 5, 'minutes')
            .toDate(),
        ),
      ),
    )

    const page0 = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: { projectId: project.id },
        sort: { fromAt: 'ASC' },
        page: 0,
        limit: 2,
      },
      throwOnError: true,
    })
    expect(page0.status).to.be.equal(200)

    const page1 = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: { projectId: project.id },
        sort: { fromAt: 'ASC' },
        page: 1,
        limit: 2,
      },
      throwOnError: true,
    })
    expect(page1.status).to.be.equal(200)

    const slice0 = page0.data[0] as Array<{ id: string }>
    const slice1 = page1.data[0] as Array<{ id: string }>
    expect(page0.data[1]).to.be.eq(4)
    expect(page1.data[1]).to.be.eq(4)
    expect(slice0.map((r) => r.id)).to.deep.eq([entries[0].id, entries[1].id])
    expect(slice1.map((r) => r.id)).to.deep.eq([entries[2].id, entries[3].id])
  }

  @test
  async search_secondPagePastTotal_returnsEmptyRows() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )

    const res = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: { projectId: project.id },
        sort: { createdAt: 'ASC' },
        page: 2,
        limit: 1,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data[0]).to.be.deep.eq([])
    expect(res.data[1]).to.be.eq(1)
  }

  @test
  async search_filter_fromAtLowerBoundExcludesEarlier() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const earlyFrom = moment.utc().subtract(300, 'minutes').toDate()
    const earlyTo = moment.utc().subtract(290, 'minutes').toDate()
    const lateFrom = moment.utc().subtract(100, 'minutes').toDate()
    const lateTo = moment.utc().subtract(90, 'minutes').toDate()

    await this.timeFixture.create(project, earlyFrom, earlyTo)
    const late = await this.timeFixture.create(project, lateFrom, lateTo)

    const res = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {
          projectId: project.id,
          fromAt: moment.utc().subtract(150, 'minutes').toISOString(),
        },
        sort: { fromAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(1)
    expect(rows[0].id).to.be.eq(late.id)
  }

  @test
  async search_filter_withScreenshots_false_excludesShotRows() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const withShot = await this.timeFixture.create(
      project,
      moment.utc().subtract(70, 'minutes').toDate(),
      moment.utc().subtract(65, 'minutes').toDate(),
    )
    const noShot = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )

    withShot.screenshot = 'has-shot'
    noShot.screenshot = null
    await this.timeRepository.saveMany([withShot, noShot])

    const res = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {
          projectId: project.id,
          withScreenshots: false,
        },
        sort: { fromAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(1)
    expect(rows[0].id).to.be.eq(noShot.id)
  }

  @test
  async search_filter_toAtUpperBound() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const earlyEnd = moment.utc().subtract(300, 'minutes').toDate()
    const lateEnd = moment.utc().subtract(30, 'minutes').toDate()

    const older = await this.timeFixture.create(
      project,
      moment.utc().subtract(310, 'minutes').toDate(),
      earlyEnd,
    )
    const newer = await this.timeFixture.create(
      project,
      moment.utc().subtract(90, 'minutes').toDate(),
      lateEnd,
    )

    const res = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {
          projectId: project.id,
          toAt: moment.utc().subtract(60, 'minutes').toISOString(),
        },
        sort: { fromAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(1)
    expect(rows[0].id).to.be.eq(older.id)
    expect(rows.some((r) => r.id === newer.id)).to.be.false
  }

  @test
  async search_filter_screenshot_substring() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const match = await this.timeFixture.create(
      project,
      moment.utc().subtract(80, 'minutes').toDate(),
      moment.utc().subtract(70, 'minutes').toDate(),
    )
    const miss = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )

    match.screenshot = 'capture-billing-v2.png'
    miss.screenshot = 'other.png'
    await this.timeRepository.saveMany([match, miss])

    const res = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {
          projectId: project.id,
          screenshot: 'billing',
        },
        sort: { fromAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(1)
    expect(rows[0].id).to.be.eq(match.id)
  }

  @test
  async search_filter_keyboardKeysTo_only() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const low = await this.timeFixture.create(
      project,
      moment.utc().subtract(120, 'minutes').toDate(),
      moment.utc().subtract(110, 'minutes').toDate(),
    )
    const high = await this.timeFixture.create(
      project,
      moment.utc().subtract(100, 'minutes').toDate(),
      moment.utc().subtract(90, 'minutes').toDate(),
    )

    low.keyboardKeys = 12
    high.keyboardKeys = 400
    await this.timeRepository.saveMany([low, high])

    const res = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {
          projectId: project.id,
          keyboardKeysTo: 50,
        },
        sort: { fromAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(1)
    expect(rows[0].id).to.be.eq(low.id)
  }

  @test
  async search_filter_mouseDistanceRange() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const near = await this.timeFixture.create(
      project,
      moment.utc().subtract(130, 'minutes').toDate(),
      moment.utc().subtract(120, 'minutes').toDate(),
    )
    const far = await this.timeFixture.create(
      project,
      moment.utc().subtract(110, 'minutes').toDate(),
      moment.utc().subtract(100, 'minutes').toDate(),
    )

    near.mouseDistance = 120
    far.mouseDistance = 9000
    await this.timeRepository.saveMany([near, far])

    const res = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {
          projectId: project.id,
          mouseDistanceFrom: 100,
          mouseDistanceTo: 500,
        },
        sort: { fromAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(1)
    expect(rows[0].id).to.be.eq(near.id)
  }

  @test
  async search_filter_minutesActiveRange() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const mid = await this.timeFixture.create(
      project,
      moment.utc().subtract(140, 'minutes').toDate(),
      moment.utc().subtract(130, 'minutes').toDate(),
    )
    const out = await this.timeFixture.create(
      project,
      moment.utc().subtract(120, 'minutes').toDate(),
      moment.utc().subtract(110, 'minutes').toDate(),
    )

    mid.minutesActive = 25
    out.minutesActive = 2
    await this.timeRepository.saveMany([mid, out])

    const res = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {
          projectId: project.id,
          minutesActiveFrom: 10,
          minutesActiveTo: 40,
        },
        sort: { fromAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(1)
    expect(rows[0].id).to.be.eq(mid.id)
  }

  @test
  async search_filter_withProcesses_false_requiresEmptyProcesses() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const emptyProc = await this.timeFixture.create(
      project,
      moment.utc().subtract(150, 'minutes').toDate(),
      moment.utc().subtract(140, 'minutes').toDate(),
    )
    const withProc = await this.timeFixture.create(
      project,
      moment.utc().subtract(135, 'minutes').toDate(),
      moment.utc().subtract(125, 'minutes').toDate(),
    )

    emptyProc.processes = []
    withProc.processes = [{ name: 'code', ms: 10 }] as never
    await this.timeRepository.saveMany([emptyProc, withProc])

    const res = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {
          projectId: project.id,
          withProcesses: false,
        },
        sort: { fromAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(1)
    expect(rows[0].id).to.be.eq(emptyProc.id)
  }

  @test
  async search_filter_fromAtAnd_toAt_combinedWindow() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const outside = await this.timeFixture.create(
      project,
      moment.utc().subtract(500, 'minutes').toDate(),
      moment.utc().subtract(490, 'minutes').toDate(),
    )
    const inside = await this.timeFixture.create(
      project,
      moment.utc().subtract(200, 'minutes').toDate(),
      moment.utc().subtract(190, 'minutes').toDate(),
    )

    const res = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: {
          projectId: project.id,
          fromAt: moment.utc().subtract(250, 'minutes').toISOString(),
          toAt: moment.utc().subtract(100, 'minutes').toISOString(),
        },
        sort: { fromAt: 'ASC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows.length).to.be.eq(1)
    expect(rows[0].id).to.be.eq(inside.id)
    expect(rows.some((r) => r.id === outside.id)).to.be.false
  }

  @test
  async search_sortBy_toAt_desc() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const a = await this.timeFixture.create(
      project,
      moment.utc().subtract(80, 'minutes').toDate(),
      moment.utc().subtract(75, 'minutes').toDate(),
    )
    const b = await this.timeFixture.create(
      project,
      moment.utc().subtract(70, 'minutes').toDate(),
      moment.utc().subtract(50, 'minutes').toDate(),
    )

    const res = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: { projectId: project.id },
        sort: { toAt: 'DESC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows[0].id).to.be.eq(b.id)
    expect(rows[1].id).to.be.eq(a.id)
  }

  @test
  async search_sortByUpdatedAt_desc() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const marker = faker.string.uuid()
    const older = await this.timeFixture.create(
      project,
      moment.utc().subtract(100, 'minutes').toDate(),
      moment.utc().subtract(90, 'minutes').toDate(),
    )
    await new Promise((resolve) => setTimeout(resolve, 30))
    const newer = await this.timeFixture.create(
      project,
      moment.utc().subtract(80, 'minutes').toDate(),
      moment.utc().subtract(70, 'minutes').toDate(),
    )

    newer.note = `updated-sort-newer-${marker}`
    older.note = `updated-sort-older-${marker}`
    await this.timeRepository.saveMany([older, newer])
    await new Promise((resolve) => setTimeout(resolve, 30))
    older.keyboardKeys = older.keyboardKeys + 1
    await this.timeRepository.saveMany([older])

    const res = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: { projectId: project.id, note: marker },
        sort: { updatedAt: 'DESC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows[0].id).to.be.eq(older.id)
    expect(rows[1].id).to.be.eq(newer.id)
  }

  @test
  async search_sortByKeyboardKeys_desc() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const low = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().subtract(50, 'minutes').toDate(),
    )
    const high = await this.timeFixture.create(
      project,
      moment.utc().subtract(40, 'minutes').toDate(),
      moment.utc().subtract(30, 'minutes').toDate(),
    )
    low.keyboardKeys = 10
    high.keyboardKeys = 200
    await this.timeRepository.saveMany([low, high])

    const res = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: { projectId: project.id },
        sort: { keyboardKeys: 'DESC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows[0].id).to.be.eq(high.id)
    expect(rows[1].id).to.be.eq(low.id)
  }

  @test
  async search_sortByMinutesActive_desc() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const low = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().subtract(50, 'minutes').toDate(),
    )
    const high = await this.timeFixture.create(
      project,
      moment.utc().subtract(40, 'minutes').toDate(),
      moment.utc().subtract(30, 'minutes').toDate(),
    )
    low.minutesActive = 2
    high.minutesActive = 9
    await this.timeRepository.saveMany([low, high])

    const res = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: { projectId: project.id },
        sort: { minutesActive: 'DESC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows[0].id).to.be.eq(high.id)
    expect(rows[1].id).to.be.eq(low.id)
  }

  @test
  async search_sortByMouseKeys_desc() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const low = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().subtract(50, 'minutes').toDate(),
    )
    const high = await this.timeFixture.create(
      project,
      moment.utc().subtract(40, 'minutes').toDate(),
      moment.utc().subtract(30, 'minutes').toDate(),
    )
    low.mouseKeys = 1
    high.mouseKeys = 15
    await this.timeRepository.saveMany([low, high])

    const res = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: { projectId: project.id },
        sort: { mouseKeys: 'DESC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows[0].id).to.be.eq(high.id)
    expect(rows[1].id).to.be.eq(low.id)
  }

  @test
  async search_sortByMouseDistance_desc() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const low = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().subtract(50, 'minutes').toDate(),
    )
    const high = await this.timeFixture.create(
      project,
      moment.utc().subtract(40, 'minutes').toDate(),
      moment.utc().subtract(30, 'minutes').toDate(),
    )
    low.mouseDistance = 100
    high.mouseDistance = 900
    await this.timeRepository.saveMany([low, high])

    const res = await timeControllerSearch({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: {
        filter: { projectId: project.id },
        sort: { mouseDistance: 'DESC' },
        page: 0,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    const rows = res.data[0] as Array<{ id: string }>
    expect(rows[0].id).to.be.eq(high.id)
    expect(rows[1].id).to.be.eq(low.id)
  }

  @test
  async search_rejectsInvalidProjectIdInFilter() {
    const user = await this.userFixture.createUser()

    let error: unknown

    try {
      await timeControllerSearch({
        client: this.apiClient(),
        headers: {
          Authorization: this.authenticator.getTokens(user).accessToken,
        },
        body: {
          filter: { projectId: 'not-a-uuid' },
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

  @test
  async search_rejectsInvalidLimitType() {
    const user = await this.userFixture.createUser()

    let error: unknown

    try {
      await timeControllerSearch({
        client: this.apiClient(),
        headers: {
          Authorization: this.authenticator.getTokens(user).accessToken,
        },
        body: {
          filter: {},
          sort: { createdAt: 'ASC' },
          page: 0,
          limit: '2' as never,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(400)
  }

  @test
  async search_rejectsInvalidSortDirection() {
    const user = await this.userFixture.createUser()
    let error: unknown

    try {
      await timeControllerSearch({
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

  @test
  async search_rejectsMissingPageField() {
    const user = await this.userFixture.createUser()
    let error: unknown

    try {
      await timeControllerSearch({
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

  @test
  async search_requiresAuthorization() {
    let error: unknown

    try {
      await timeControllerSearch({
        client: this.apiClient(),
        body: {
          filter: {},
          sort: { createdAt: 'ASC' },
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
