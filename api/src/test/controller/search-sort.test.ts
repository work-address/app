import { suite, test } from '@testdeck/mocha'
import axios from 'axios'
import { expect } from 'chai'

import { App } from '@/app/app'
import { Project } from '@/entity/project'
import { Time } from '@/entity/time'
import { User } from '@/entity/user'
import { EProjectState } from '@/model/project'
import { BaseControllerTest } from '@/test/controller/base-controller.test'

/** What a request could try in place of a column name. */
const HOSTILE_KEYS = [
  'nonexistent',
  'id, (SELECT CAST(current_user AS int))',
  'id" ASC, (SELECT CAST(current_user AS int)) --',
  'id", (SELECT CAST(current_user AS int)) -- ',
  'id" ASC LIMIT (SELECT CAST(current_user AS int)) --',
  String.raw`id\" ASC, (SELECT CAST(current_user AS int)) --`,
  "id' OR 1=1 --",
  'a"."b',
  'project.title',
  'user.address',
]

/** What a request could try in place of ASC or DESC. */
const HOSTILE_DIRECTIONS = [
  'asc',
  'ASC, (SELECT CAST(current_user AS int))',
  'ASC LIMIT (SELECT CAST(current_user AS int)) --',
  { order: 'ASC', nulls: 'NULLS FIRST' },
  { order: 'ASC', nulls: 'NULLS FIRST, (SELECT 1)' },
  null,
  1,
]

/** Real columns the entry list does not offer. The first four hold Detail. */
const UNLISTED_TIME_COLUMNS = [
  'processes',
  'appsReason',
  'appsStatus',
  'appsTruncated',
  'id',
  'source',
  'publishedAt',
  'isPaid',
  'invoiceId',
  'projectId',
  'userId',
  'fromIndex',
  'toIndex',
]

const UNLISTED_PROJECT_COLUMNS = [
  'text',
  'userId',
  'workerAddresses',
  'viewerAddresses',
  'deletedAt',
  'reviewWindowHours',
]

const DETAIL_SORT_KEYS = [
  'note',
  'keyboardKeys',
  'minutesActive',
  'mouseKeys',
  'mouseDistance',
  'screenshot',
]

/** `TIME_SORT_FIELDS` in the web feature, plus the rest the search documents. */
const TIME_SORT_KEYS = [
  ...DETAIL_SORT_KEYS,
  'fromAt',
  'toAt',
  'createdAt',
  'updatedAt',
  'projectName',
  'paidStatus',
]

const PROJECT_SORT_KEYS = [
  'id',
  'createdAt',
  'updatedAt',
  'title',
  'state',
  'rateHour',
  'trackScreenshots',
  'trackProcesses',
]

const SEARCHES = [
  { path: '/time/search', rows: 'time entries' },
  { path: '/project/search', rows: 'projects' },
  { path: '/invoice/search', rows: 'invoices' },
]

@suite
export class SearchSortTest extends BaseControllerTest {
  private client(user: User) {
    return axios.create({
      baseURL: `${this.url}/api`,
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      validateStatus: () => true,
    })
  }

  /** A search with rows behind it, so nothing passes for lack of a result. */
  private async ownerWithRows() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner)
    await this.timeFixture.create(
      project,
      new Date(Date.now() - 3600_000),
      new Date(Date.now() - 3000_000),
    )
    return this.client(owner)
  }

  @test
  async search_refusesKeysItDoesNotList() {
    const client = await this.ownerWithRows()

    for (const { path, rows } of SEARCHES) {
      for (const key of HOSTILE_KEYS) {
        const response = await client.post(path, {
          filter: {},
          sort: { [key]: 'ASC' },
          page: 0,
        })

        expect(response.status, `${path} ${key}`).to.equal(400)
        expect(response.data.message).to.equal(`Cannot sort ${rows} by ${key}`)
      }
    }
  }

  @test
  async search_refusesABadKeyBehindAGoodOne() {
    const client = await this.ownerWithRows()

    for (const { path, rows } of SEARCHES) {
      const response = await client.post(path, {
        filter: {},
        sort: { createdAt: 'ASC', 'id, (SELECT 1)': 'ASC' },
        page: 0,
      })

      expect(response.status, path).to.equal(400)
      expect(response.data.message).to.equal(
        `Cannot sort ${rows} by id, (SELECT 1)`,
      )
    }
  }

  @test
  async search_refusesAnyDirectionButAscAndDesc() {
    const client = await this.ownerWithRows()

    for (const { path } of SEARCHES) {
      // `createdAt` is checked by the search's DTO where it lists it, and the
      // other key by nothing but the allow-list.
      for (const key of ['createdAt', 'nonexistent']) {
        for (const direction of HOSTILE_DIRECTIONS) {
          const response = await client.post(path, {
            filter: {},
            sort: { [key]: direction },
            page: 0,
          })

          expect(
            response.status,
            `${path} ${key} ${JSON.stringify(direction)}`,
          ).to.equal(400)
        }
      }
    }
  }

  /**
   * class-transformer drops a key that names a method of the DTO, so these
   * reach the repository as no sort at all. The answer is the unsorted list.
   */
  @test
  async search_treatsObjectMethodNamesAsNoSort() {
    const client = await this.ownerWithRows()

    for (const { path } of SEARCHES) {
      for (const key of ['constructor', 'toString', 'hasOwnProperty']) {
        const response = await client.post(path, {
          filter: {},
          sort: { [key]: 'ASC' },
          page: 0,
        })

        expect(response.status, `${path} ${key}`).to.equal(200)
      }
      const proto = await client.post(
        path,
        '{"filter":{},"page":0,"sort":{"__proto__":"ASC"}}',
        { headers: { 'content-type': 'application/json' } },
      )

      expect(proto.status, `${path} __proto__`).to.equal(200)
    }
  }

  @test
  async timeSearch_refusesColumnsOffTheList() {
    const client = await this.ownerWithRows()

    for (const key of UNLISTED_TIME_COLUMNS) {
      const response = await client.post('/time/search', {
        filter: {},
        sort: { [key]: 'ASC' },
        page: 0,
      })

      expect(response.status, key).to.equal(400)
    }
  }

  @test
  async projectSearch_refusesColumnsOffTheList() {
    const client = await this.ownerWithRows()

    for (const key of UNLISTED_PROJECT_COLUMNS) {
      const response = await client.post('/project/search', {
        filter: {},
        sort: { [key]: 'ASC' },
        page: 0,
      })

      expect(response.status, key).to.equal(400)
    }
  }

  @test
  async timeSearch_ordersByEveryListedKey() {
    const owner = await this.userFixture.createUser()
    const alpha = await this.projectFixture.createPersonal(owner)
    const beta = await this.projectFixture.createPersonal(owner)
    await App.conn.manager.update(Project, alpha.id, { title: 'alpha' })
    await App.conn.manager.update(Project, beta.id, { title: 'beta' })
    const end = Date.now() - 3600_000
    const low = await this.timeFixture.create(
      alpha,
      new Date(end - 1200_000),
      new Date(end - 600_000),
    )
    const high = await this.timeFixture.create(
      beta,
      new Date(end - 600_000),
      new Date(end),
    )
    const detail = (value: number) => ({
      note: String(value),
      keyboardKeys: value,
      minutesActive: value,
      mouseKeys: value,
      mouseDistance: value,
      screenshot: String(value),
      createdAt: new Date(end + value),
      updatedAt: new Date(end + value),
    })
    await App.conn.manager.update(Time, low.id, {
      ...detail(1),
      isPaid: false,
    })
    await App.conn.manager.update(Time, high.id, {
      ...detail(2),
      isPaid: true,
    })
    const client = this.client(owner)

    for (const key of TIME_SORT_KEYS) {
      for (const [direction, expected] of [
        ['ASC', [low.id, high.id]],
        ['DESC', [high.id, low.id]],
      ] as const) {
        const response = await client.post('/time/search', {
          filter: {},
          sort: { [key]: direction },
          page: 0,
        })

        expect(response.status, `${key} ${direction}`).to.equal(200)
        expect(
          response.data[0].map((row: Time) => row.id),
          `${key} ${direction}`,
        ).to.deep.equal(expected)
      }
    }
  }

  @test
  async projectSearch_ordersByEveryListedKey() {
    const owner = await this.userFixture.createUser()
    const first = await this.projectFixture.createPersonal(owner)
    const second = await this.projectFixture.createPersonal(owner)
    const [low, high] = [first.id, second.id].sort()
    const at = new Date('2026-01-01T00:00:00Z').getTime()
    await App.conn.manager.update(Project, low, {
      title: 'alpha',
      state: EProjectState.ACTIVE,
      rateHour: 10,
      trackScreenshots: false,
      trackProcesses: false,
      createdAt: new Date(at),
      updatedAt: new Date(at),
    })
    await App.conn.manager.update(Project, high, {
      title: 'beta',
      state: EProjectState.INACTIVE,
      rateHour: 90,
      trackScreenshots: true,
      trackProcesses: true,
      createdAt: new Date(at + 1000),
      updatedAt: new Date(at + 1000),
    })
    const client = this.client(owner)

    for (const key of PROJECT_SORT_KEYS) {
      for (const [direction, expected] of [
        ['ASC', [low, high]],
        ['DESC', [high, low]],
      ] as const) {
        const response = await client.post('/project/search', {
          filter: {},
          sort: { [key]: direction },
          page: 0,
        })

        expect(response.status, `${key} ${direction}`).to.equal(200)
        expect(
          response.data[0].map((row: Project) => row.id),
          `${key} ${direction}`,
        ).to.deep.equal(expected)
      }
    }
  }

  @test
  async projectSearch_rateSortsOnlyByWhatTheReaderMaySee() {
    const owner = await this.userFixture.createPremiumUser()
    const viewer = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const both = await this.userFixture.createUser()
    const onBothLists = [viewer.address, both.address]
    const first = await this.projectFixture.createPersonal(owner)
    const second = await this.projectFixture.createPersonal(owner)
    const [low, high] = [first.id, second.id].sort()
    const setRates = async (lowRate: number, highRate: number) => {
      await App.conn.manager.update(Project, low, { rateHour: lowRate })
      await App.conn.manager.update(Project, high, { rateHour: highRate })
    }
    await App.conn.manager.update(Project, [low, high], {
      viewerAddresses: onBothLists,
      workerAddresses: [worker.address, both.address],
    })
    await setRates(10, 90)
    const ids = async (user: User, direction: string, extra = {}) => {
      const response = await this.client(user).post('/project/search', {
        filter: {},
        sort: { rateHour: direction },
        page: 0,
        ...extra,
      })

      expect(response.status).to.equal(200)
      return response.data[0].map((row: Project) => row.id)
    }

    // A viewer gets no rate, so no order may tell one project's from another's:
    // both directions, and both ways round, fall through to the same tie-break.
    for (const direction of ['ASC', 'DESC']) {
      expect(await ids(viewer, direction), direction).to.deep.equal([low, high])
    }
    await setRates(90, 10)
    for (const direction of ['ASC', 'DESC']) {
      expect(await ids(viewer, direction), direction).to.deep.equal([low, high])
    }

    // Offset pages run the same order, so paging cannot reveal it either.
    for (const [page, expected] of [low, high].entries()) {
      expect(await ids(viewer, 'DESC', { page, limit: 1 })).to.deep.equal([
        expected,
      ])
    }

    // Everyone the rate is shown to sorts by it, whoever else they also are.
    await setRates(10, 90)
    for (const reader of [owner, worker, both]) {
      expect(await ids(reader, 'ASC')).to.deep.equal([low, high])
      expect(await ids(reader, 'DESC')).to.deep.equal([high, low])
    }
  }

  /** A viewer on one project and a worker on another sees only that one's. */
  @test
  async projectSearch_rateSortsAcrossRolesWithoutRankingTheHiddenRate() {
    const owner = await this.userFixture.createPremiumUser()
    const reader = await this.userFixture.createUser()
    const worked = await this.projectFixture.createPersonal(owner)
    const viewed = await this.projectFixture.createPersonal(owner)
    await App.conn.manager.update(Project, worked.id, {
      rateHour: 50,
      workerAddresses: [reader.address],
    })
    await App.conn.manager.update(Project, viewed.id, {
      viewerAddresses: [reader.address],
    })
    const ids = async (direction: string) => {
      const response = await this.client(reader).post('/project/search', {
        filter: {},
        sort: { rateHour: direction },
        page: 0,
      })

      expect(response.status).to.equal(200)
      return response.data[0].map((row: Project) => row.id)
    }

    // Whatever the viewed project's rate, it sorts as no value at all: last
    // going up and first going down, as Postgres places a NULL.
    for (const rate of [1, 99]) {
      await App.conn.manager.update(Project, viewed.id, { rateHour: rate })
      expect(await ids('ASC'), `rate ${rate}`).to.deep.equal([
        worked.id,
        viewed.id,
      ])
      expect(await ids('DESC'), `rate ${rate}`).to.deep.equal([
        viewed.id,
        worked.id,
      ])
    }
  }

  /** The desktop tracker lists projects with no sort and a limit of zero. */
  @test
  async search_stillRunsWithNoSort() {
    const client = await this.ownerWithRows()

    for (const body of [
      { filter: {}, page: 0, sort: {}, limit: 0 },
      { filter: {}, page: 0, sort: {} },
    ]) {
      for (const path of ['/time/search', '/project/search']) {
        const response = await client.post(path, body)

        expect(response.status, path).to.equal(200)
        expect(response.data[0].length, path).to.equal(1)
      }
    }
  }

  @test
  async timeSearch_detailKeepsItsGuardAndStaysOffTheListOtherwise() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner)
    project.workerAddresses = [worker.address]
    await App.conn.manager.save(project)
    const end = Date.now() - 60_000
    const low = await this.timeFixture.create(
      project,
      new Date(end - 1200_000),
      new Date(end - 600_000),
      worker,
    )
    const high = await this.timeFixture.create(
      project,
      new Date(end - 600_000),
      new Date(end),
      worker,
    )
    const detail = (value: number, app: string) => ({
      note: String(value),
      keyboardKeys: value,
      minutesActive: value,
      mouseKeys: value,
      mouseDistance: value,
      screenshot: String(value),
      processes: [{ name: app, timeMin: value }],
      appsReason: app,
      appsStatus: app,
      appsTruncated: value > 1,
    })
    await App.conn.manager.update(Time, low.id, detail(1, 'a') as never)
    await App.conn.manager.update(Time, high.id, detail(2, 'z') as never)
    const ids = async (user: User, key: string, direction: string) => {
      const response = await this.client(user).post('/time/search', {
        filter: { projectId: project.id },
        sort: { [key]: direction },
        page: 0,
      })

      expect(response.status, `${key} ${direction}`).to.equal(200)
      return response.data[0].map((row: Time) => row.id)
    }

    // The owner has not been given this Detail yet, so neither direction may
    // tell the entries apart: both fall through to the same tie-break.
    for (const key of DETAIL_SORT_KEYS) {
      expect(await ids(owner, key, 'ASC'), key).to.deep.equal(
        await ids(owner, key, 'DESC'),
      )
    }

    // Its author sorts by the real values.
    for (const key of DETAIL_SORT_KEYS) {
      expect(await ids(worker, key, 'ASC'), key).to.deep.equal([
        low.id,
        high.id,
      ])
      expect(await ids(worker, key, 'DESC'), key).to.deep.equal([
        high.id,
        low.id,
      ])
    }

    // Detail with no guard cannot be asked for at all, by anyone.
    for (const user of [owner, worker]) {
      for (const key of UNLISTED_TIME_COLUMNS.slice(0, 4)) {
        const response = await this.client(user).post('/time/search', {
          filter: { projectId: project.id },
          sort: { [key]: 'ASC' },
          page: 0,
        })

        expect(response.status, key).to.equal(400)
      }
    }
  }
}
