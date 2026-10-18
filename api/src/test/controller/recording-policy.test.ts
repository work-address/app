import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import axios from 'axios'
import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { App } from '@/app/app'
import { User } from '@/entity/user'
import { Project } from '@/entity/project'
import { Time } from '@/entity/time'
import { Invoice } from '@/entity/invoice'
import { ILogger } from '@/model/logging'

@suite()
export class RecordingPolicyTest extends BaseControllerTest {
  private client(user: User) {
    return axios.create({
      baseURL: `${this.url}/api`,
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      validateStatus: () => true,
    })
  }
  @test() async mixedCaseRecordingRoutesNeverLogPrivateBodies() {
    const worker = await this.userFixture.createUser()
    const client = this.client(worker)
    const logger = App.container.get<ILogger>('ILogger')
    const original = logger.info
    const recorded: unknown[] = []
    logger.info = (message, data) => {
      if (message === 'request data') recorded.push(data)
    }
    try {
      const rules = [
        {
          field: 'title',
          match: 'contains',
          pattern: 'private-fixture-pattern',
        },
      ]
      expect(
        (
          await client.put(`${this.url}/API/UsEr/SeTtInGs/`, {
            personalRedactionRules: rules,
          })
        ).status,
      ).to.equal(200)
      expect(
        (await client.get('/user/settings')).data.personalRedactionRules,
      ).to.deep.equal(rules)
      expect(recorded).not.to.be.empty
      expect(
        recorded.every(
          (row) => !Object.prototype.hasOwnProperty.call(row, 'body'),
        ),
      ).to.equal(true)
      expect(JSON.stringify(recorded)).not.to.contain('private-fixture-pattern')
      const malformed = await client.post(
        `${this.url}/API/AGENT-TRACKING/EVENTS/`,
        '{"private-fixture-pattern":',
        {
          headers: { 'Content-Type': 'application/json' },
        },
      )
      expect(malformed.status).to.equal(400)
      expect(malformed.data).to.deep.equal({
        name: 'IngestError',
        message: 'INVALID_ENVELOPE',
      })
    } finally {
      logger.info = original
    }
  }

  @test() async publicationRejectsMixedOwnershipWithoutPublishingAnyEntry() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner)
    project.workerAddresses = [worker.address]
    await App.conn.manager.save(project)
    const end = new Date(Date.now() - 60000)
    const own = await this.timeFixture.create(
      project,
      new Date(+end - 600000),
      end,
      owner,
    )
    const other = await this.timeFixture.create(
      project,
      new Date(+end - 600000),
      end,
      worker,
    )
    const client = this.client(owner)
    expect(
      (await client.post('/time/publish', { ids: [own.id, other.id] })).status,
    ).to.equal(403)
    for (const id of [own.id, other.id])
      expect(
        (await App.conn.manager.findOneByOrFail(Time, { id })).publishedAt,
      ).to.equal(null)
    expect(
      (await client.post('/time/publish', { ids: [own.id] })).status,
    ).to.equal(200)
  }

  @test() async expiredScreenshotsBehaveAsAbsentInEverySearchFilter() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner)
    project.workerAddresses = [worker.address]
    project.screenshotRetentionDays = 1
    await App.conn.manager.save(project)
    const end = Date.now() - 60000
    const entries = []
    for (const offset of [2 * 86400000, 0, 600000]) {
      entries.push(
        await this.timeFixture.create(
          project,
          new Date(end - offset - 600000),
          new Date(end - offset),
          worker,
        ),
      )
    }
    const [expired, retained, missing] = entries
    for (const entry of entries)
      await App.conn.manager.update(Time, entry.id, {
        publishedAt: new Date(),
        screenshot: entry === missing ? null : 'secret-image',
      })
    for (const actor of [owner, worker]) {
      const client = this.client(actor)
      for (const [filter, expected] of [
        [{ screenshot: 'secret-image' }, [retained.id]],
        [{ screenshot: 'not-present' }, []],
        [{ withScreenshots: true }, [retained.id]],
        [{ withScreenshots: false }, [expired.id, missing.id]],
        [{ screenshot: 'secret', withScreenshots: false }, []],
      ] as const) {
        const response = await client.post('/time/search', {
          filter: { projectId: project.id, ...filter },
          sort: { fromAt: 'ASC' },
          page: 0,
        })
        expect(response.status).to.equal(200)
        expect(response.data[1]).to.equal(expected.length)
        expect(
          response.data[0].map((row: Time) => row.id).sort(),
        ).to.deep.equal([...expected].sort())
      }
      const response = await client.post('/time/search', {
        filter: { projectId: project.id, withScreenshots: false },
        sort: { fromAt: 'ASC' },
        page: 0,
        limit: 1,
      })
      expect(response.data[1]).to.equal(2)
      expect(response.data[0][0]).to.include({
        id: expired.id,
        screenshot: null,
      })
    }
    // The filter must not depend on cleanup having physically removed the image.
    expect(
      (await App.conn.manager.findOneByOrFail(Time, { id: expired.id }))
        .screenshot,
    ).to.equal('secret-image')
    await App.conn.manager.update(Project, project.id, {
      screenshotRetentionDays: null,
    })
    const unlimited = await this.client(owner).post('/time/search', {
      filter: { projectId: project.id, screenshot: 'secret-image' },
      sort: {},
      page: 0,
    })
    expect(unlimited.data[1]).to.equal(2)
  }

  @test() async disabledRecordingIsExcludedFromGapsButNotTimeTotals() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.createPersonal(owner)
    project.trackProcesses = true
    await App.conn.manager.save(project)
    const client = this.client(owner)
    const end = Date.now() - 60000
    const rows = ['off', 'partial', undefined].map((appsStatus, index) => ({
      projectId: project.id,
      fromAt: new Date(end - (index + 1) * 600000).toISOString(),
      toAt: new Date(end - index * 600000).toISOString(),
      fromIndex: index,
      toIndex: index + 1,
      note: '',
      keyboardKeys: 1,
      mouseKeys: 0,
      mouseDistance: 0,
      minutesActive: 1,
      appsStatus,
      apps: appsStatus === 'partial' ? [{ name: 'Editor', seconds: 30 }] : [],
    }))
    const upload = await client.post('/time', rows)
    expect(upload.status).to.equal(200)
    expect(
      upload.data.every((row: { error?: unknown }) => !row.error),
    ).to.equal(true)
    const query = {
      projectIds: [project.id],
      from: new Date(end - 86400000).toISOString().slice(0, 10),
      to: new Date(end + 86400000).toISOString().slice(0, 10),
      timeZone: 'UTC',
    }
    for (const route of ['/statistics/overview', '/statistics/apps/summary']) {
      const response = await client.post(route, query)
      expect(response.status).to.equal(200)
      expect(
        response.data.gaps
          .map((row: { reason: string; seconds: string }) => [
            row.reason,
            Number(row.seconds),
          ])
          .sort(),
      ).to.deep.equal([
        ['legacy', 60],
        ['partial', 30],
      ])
      expect(Number(response.data.totals[0].trackedSeconds)).to.equal(1800)
      expect(Number(response.data.totals[0].activeSeconds)).to.equal(180)
      expect(Number(response.data.apps[0].seconds)).to.equal(30)
    }
  }

  @test() async sortingCannotRevealUnpublishedOrOtherWorkersDetail() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const colleague = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner)
    project.workerAddresses = [worker.address, colleague.address]
    project.viewerAddresses = [viewer.address]
    await App.conn.manager.save(project)
    const end = Date.now() - 60000
    const entries = []
    for (const [index, author] of [
      worker,
      worker,
      owner,
      colleague,
    ].entries()) {
      entries.push(
        await this.timeFixture.create(
          project,
          new Date(end - (index + 1) * 600000),
          new Date(end - index * 600000),
          author,
        ),
      )
    }
    const fields = (value: number) => ({
      keyboardKeys: value,
      minutesActive: value,
      mouseKeys: value,
      mouseDistance: value,
      note: String(value),
      screenshot: String(value),
    })
    await App.conn.manager.update(Time, entries[0].id, fields(1))
    await App.conn.manager.update(Time, entries[1].id, fields(9))
    await App.conn.manager.update(Time, entries[2].id, fields(5))
    await App.conn.manager.update(Time, entries[3].id, fields(5))
    const snapshots: {
      actor: User
      key: string
      direction: string
      ids: string[]
    }[] = []
    for (const actor of [owner, colleague, viewer]) {
      for (const key of Object.keys(fields(0))) {
        for (const direction of ['ASC', 'DESC']) {
          const response = await this.client(actor).post('/time/search', {
            filter: { projectId: project.id },
            sort: { [key]: direction },
            page: 0,
          })
          expect(response.status).to.equal(200)
          expect(response.data[1]).to.equal(4)
          snapshots.push({
            actor,
            key,
            direction,
            ids: response.data[0].map((row: Time) => row.id),
          })
        }
      }
    }
    await App.conn.manager.update(Time, entries[0].id, fields(9))
    await App.conn.manager.update(Time, entries[1].id, fields(1))
    for (const snapshot of snapshots) {
      const response = await this.client(snapshot.actor).post('/time/search', {
        filter: { projectId: project.id },
        sort: { [snapshot.key]: snapshot.direction },
        page: 0,
      })
      expect(response.status).to.equal(200)
      expect(response.data[0].map((row: Time) => row.id)).to.deep.equal(
        snapshot.ids,
      )
    }
    // Pagination must use the same redacted ordering, and authors still sort their own detail.
    const full = snapshots.find(
      (s) =>
        s.actor === owner && s.key === 'keyboardKeys' && s.direction === 'ASC',
    )!
    for (let page = 0; page < 4; page++) {
      const response = await this.client(owner).post('/time/search', {
        filter: { projectId: project.id },
        sort: { keyboardKeys: 'ASC' },
        page,
        limit: 1,
      })
      expect(response.data[0][0].id).to.equal(full.ids[page])
    }
    const own = await this.client(worker).post('/time/search', {
      filter: { projectId: project.id },
      sort: { keyboardKeys: 'ASC' },
      page: 0,
    })
    expect(own.data[0].slice(0, 2).map((row: Time) => row.id)).to.deep.equal([
      entries[1].id,
      entries[0].id,
    ])
    expect(
      (
        await this.client(worker).post('/time/publish', {
          ids: [entries[0].id, entries[1].id],
        })
      ).status,
    ).to.equal(200)
    const published = await this.client(owner).post('/time/search', {
      filter: { projectId: project.id },
      sort: { keyboardKeys: 'ASC' },
      page: 0,
    })
    expect(
      published.data[0].slice(0, 3).map((row: Time) => row.id),
    ).to.deep.equal([entries[1].id, entries[2].id, entries[0].id])
  }

  @test()
  async legacyNullPoliciesAllowRenamingAndClosingButInvalidPoliciesFail() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.createPersonal(owner)
    const client = this.client(owner)
    await App.conn.manager.update(Project, project.id, {
      trackProcesses: null,
      trackScreenshots: null,
    })
    expect(
      (
        await client.put(`/project/${project.id}`, {
          title: 'Renamed legacy project',
        })
      ).status,
    ).to.equal(200)
    let stored = await App.conn.manager.findOneByOrFail(Project, {
      id: project.id,
    })
    expect(stored).to.include({
      title: 'Renamed legacy project',
      trackProcesses: false,
      trackScreenshots: false,
    })
    for (const policy of [
      { trackProcesses: 'true' },
      { trackAgents: null },
      { trackWindowTitles: null },
    ]) {
      expect(
        (await client.put(`/project/${project.id}`, policy)).status,
      ).to.equal(400)
    }
    await App.conn.manager.update(Project, project.id, {
      trackProcesses: null,
      trackScreenshots: null,
    })
    expect(
      (await client.post(`/project/${project.id}/close`, {})).status,
    ).to.equal(200)
    stored = await App.conn.manager.findOneByOrFail(Project, { id: project.id })
    expect(stored).to.include({
      trackProcesses: false,
      trackScreenshots: false,
    })
  }

  @test() async rejectedLegacyInvoiceRetainsItsChargedLineAfterReissue() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    project.workerAddresses = [worker.address]
    await App.conn.manager.save(project)
    const end = new Date(Date.now() - 60000)
    const entry = await this.timeFixture.create(
      project,
      new Date(+end - 600000),
      end,
      worker,
    )
    await App.conn.manager.update(Time, entry.id, { minutesActive: 5 })
    const client = this.client(worker)
    const issued = await client.post(`/invoice/project/${project.id}`, {
      timeIds: [entry.id],
    })
    expect(issued.status).to.equal(200)
    const id = issued.data.id
    await App.conn.manager.update(Invoice, id, {
      lines: null,
      amountCents: 500,
    })
    const before = (await client.get(`/invoice/${id}`)).data
    expect(
      (await this.client(owner).post(`/invoice/${id}/reject`, {})).status,
    ).to.equal(200)
    expect(
      (
        await client.post(`/invoice/project/${project.id}`, {
          timeIds: [entry.id],
        })
      ).status,
    ).to.equal(200)
    const after = (await client.get(`/invoice/${id}`)).data
    expect(after.lines).to.deep.equal(before.lines)
    expect(after.report).to.include({ minutes: 5, rateHour: 60, rateTotal: 5 })
  }
  @test() async privateSettingsStayPrivateAndRejectInvalidRules() {
    const worker = await this.userFixture.createUser()
    const other = await this.userFixture.createUser()
    const client = this.client(worker)
    const rules = [
      { field: 'title', match: 'contains', pattern: 'personal-bank' },
    ]
    expect(
      (await client.put('/user/settings', { personalRedactionRules: rules }))
        .status,
    ).to.equal(200)
    expect(
      (await client.get('/user/settings')).data.personalRedactionRules,
    ).to.deep.equal(rules)
    expect(
      (await this.client(other).get('/user/settings')).data
        .personalRedactionRules,
    ).to.deep.equal([])
    expect(
      JSON.stringify(
        (await client.get(`/user/${worker.address}/address`)).data,
      ),
    ).not.to.contain('personal-bank')
    expect(
      (
        await client.put('/user/settings', {
          personalRedactionRules: [
            { field: 'prompt', match: 'contains', pattern: 'secret' },
          ],
        })
      ).status,
    ).to.equal(400)
  }
  @test() async uploadReviewStatisticsAndInvoiceRejectionWorkOverHttp() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    project.workerAddresses = [worker.address]
    project.trackProcesses = true
    await App.conn.manager.save(project)
    const client = this.client(worker),
      ownerClient = this.client(owner)
    const end = new Date(Date.now() - 60000)
    const payload = {
      projectId: project.id,
      fromAt: new Date(+end - 600000).toISOString(),
      toAt: end.toISOString(),
      fromIndex: 1,
      toIndex: 2,
      note: '',
      keyboardKeys: 1,
      mouseKeys: 0,
      mouseDistance: 0,
      minutesActive: 5,
      appsStatus: 'ok',
      apps: [{ name: 'Editor', seconds: 300 }],
    }
    const upload = await client.post('/time', [payload])
    expect(upload.status).to.equal(200)
    expect(upload.data[0].appsAccepted).to.equal(true)
    const id = upload.data[0].id
    const before = await ownerClient.get(`/time/${id}`)
    expect(before.data.detailPendingReview).to.equal(true)
    expect(before.data.apps).to.equal(undefined)
    expect((await client.post('/time/publish', { ids: [id] })).status).to.equal(
      200,
    )
    expect(
      (await ownerClient.get(`/time/${id}`)).data.apps[0].seconds,
    ).to.equal(300)
    for (const changed of [
      {
        ...payload,
        toAt: new Date(Date.parse(payload.fromAt) + 60000).toISOString(),
        minutesActive: 1,
        apps: [{ name: 'Editor', seconds: 60 }],
      },
      { ...payload, minutesActive: 1 },
    ]) {
      const retry = await client.post('/time', [changed])
      expect(retry.status).to.equal(200)
      expect(retry.data[0].error.name).to.equal('BadRequestError')
      expect(retry.data[0].appsAccepted).to.equal(undefined)
    }
    expect(
      (await client.post('/time', [payload])).data[0].appsAccepted,
    ).to.equal(true)
    const preserved = (await ownerClient.get(`/time/${id}`)).data
    expect(preserved.minutesActive).to.equal(5)
    expect(preserved.toAt).to.equal(payload.toAt)
    expect(preserved.apps[0].seconds).to.equal(300)
    const invoice = await client.post(`/invoice/project/${project.id}`, {
      timeIds: [id],
    })
    expect(invoice.data.amountCents).to.equal(1000)
    expect(invoice.data.lines[0]).to.include({
      basis: 'tracked',
      minutes: 10,
      activeMinutes: 5,
    })
    expect(
      (await client.post(`/invoice/${invoice.data.id}/reject`, {})).status,
    ).to.equal(403)
    expect(
      (
        await ownerClient.post(`/invoice/${invoice.data.id}/reject`, {
          reason: 'Correction requested',
        })
      ).data.state,
    ).to.equal('REJECTED')
    expect(
      (await client.post(`/invoice/project/${project.id}`, { timeIds: [id] }))
        .data.id,
    ).not.to.equal(invoice.data.id)
  }
}
