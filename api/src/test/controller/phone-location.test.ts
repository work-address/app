import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import axios from 'axios'
import moment from 'moment'

import { App } from '@/app/app'
import { Project } from '@/entity/project'
import { Time } from '@/entity/time'
import { TimeLocation } from '@/entity/time-location'
import { User } from '@/entity/user'
import { BaseControllerTest } from '@/test/controller/base-controller.test'

/**
 * Where the phone was, over HTTP, as the phone and the web app reach it
 * (time-tracker/docs/android-server.md, step 2).
 */
@suite()
export class PhoneLocationTest extends BaseControllerTest {
  private client(user: User) {
    return axios.create({
      baseURL: `${this.url}/api`,
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      validateStatus: () => true,
    })
  }

  /** A project that takes phone time and asks for location. */
  private async world({ trackLocation = true } = {}) {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    project.workerAddresses = [worker.address]
    project.viewerAddresses = [viewer.address]
    await App.conn.manager.save(project)
    const edit = await this.client(owner).put(`/project/${project.id}`, {
      allowMobileTime: true,
      trackLocation,
    })
    expect(edit.status).to.equal(200)

    return { owner, worker, viewer, project }
  }

  private stored(project: Project) {
    return App.conn.manager.findOneByOrFail(Project, { id: project.id })
  }

  private async listed(project: Project, user: User) {
    const response = await this.client(user).post('/project/search', {
      filter: {},
      sort: { createdAt: 'ASC' },
      page: 0,
    })
    expect(response.status).to.equal(200)

    return (response.data[0] as Project[]).find((row) => row.id === project.id)
  }

  /**
   * A phone's slice ending `endsAgo` minutes ago. Times are zone-less, as the
   * phone sends them, and read back the same way.
   */
  private slice(project: Project, endsAgo: number, fields: object = {}) {
    const end = moment().subtract(endsAgo, 'minutes').startOf('minute')
    const start = end.clone().subtract(10, 'minutes')

    return {
      projectId: project.id,
      fromAt: this.zoneless(start),
      toAt: this.zoneless(end),
      fromIndex: 0,
      toIndex: 1,
      note: '',
      keyboardKeys: 0,
      mouseKeys: 0,
      mouseDistance: 0,
      minutesActive: 10,
      source: 'mobile',
      locationStatus: 'ok',
      locations: [
        this.fix(start, 1, { latitude: 52.37, longitude: 4.89, accuracy: 12 }),
        this.fix(start, 2, { latitude: null, longitude: null, accuracy: null }),
        this.fix(start, 3, { latitude: 52.38, longitude: 4.9, accuracy: 30 }),
      ],
      ...fields,
    }
  }

  private fix(start: moment.Moment, minute: number, fields: object) {
    return {
      at: this.zoneless(start.clone().add(minute, 'minutes')),
      mock: false,
      ...fields,
    }
  }

  private zoneless(at: moment.Moment) {
    return at.format('YYYY-MM-DDTHH:mm:ss')
  }

  private points(id: string) {
    return App.conn.manager.find(TimeLocation, {
      where: { time: { id } },
      order: { at: 'ASC' },
    })
  }

  private entry(id: string) {
    return App.conn.manager.findOneByOrFail(Time, { id })
  }

  @test() async locationIsOffUntilTheOwnerAsksForIt() {
    const { owner, worker, project } = await this.world({
      trackLocation: false,
    })

    expect((await this.stored(project)).trackLocation).to.equal(false)
    expect((await this.listed(project, worker))?.trackLocation).to.equal(false)

    const edit = await this.client(owner).put(`/project/${project.id}`, {
      trackLocation: true,
    })
    expect(edit.status).to.equal(200)
    expect((await this.listed(project, worker))?.trackLocation).to.equal(true)

    const byWorker = await this.client(worker).put(`/project/${project.id}`, {
      trackLocation: false,
    })
    expect(byWorker.status).to.equal(403)
    expect((await this.stored(project)).trackLocation).to.equal(true)
  }

  @test() async locationIsNeverOnWithoutPhoneTime() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    const set = (body: object) =>
      this.client(owner).put(`/project/${project.id}`, body)

    expect((await set({ trackLocation: true })).status).to.equal(200)
    expect((await this.stored(project)).trackLocation).to.equal(false)

    expect(
      (await set({ allowMobileTime: true, trackLocation: true })).status,
    ).to.equal(200)
    expect((await this.stored(project)).trackLocation).to.equal(true)

    // Turning phone time off turns location off in the same write.
    expect((await set({ allowMobileTime: false })).status).to.equal(200)
    const off = await this.stored(project)
    expect(off.allowMobileTime).to.equal(false)
    expect(off.trackLocation).to.equal(false)

    // And turning phone time back on does not bring location back.
    expect((await set({ allowMobileTime: true })).status).to.equal(200)
    expect((await this.stored(project)).trackLocation).to.equal(false)
  }

  @test() async theSwitchMustBeABoolean() {
    const { owner, project } = await this.world({ trackLocation: false })

    for (const trackLocation of ['true', null, 1]) {
      const edit = await this.client(owner).put(`/project/${project.id}`, {
        trackLocation,
      })
      expect(edit.status, String(trackLocation)).to.equal(400)
    }
  }

  @test() async aPhoneSliceKeepsItsFixesInOrder() {
    const { worker, project } = await this.world()
    const sent = this.slice(project, 1)
    // Sent out of order, and with a faked fix: kept, sorted, and marked.
    sent.locations = [
      sent.locations[2],
      { ...sent.locations[0], mock: true },
      sent.locations[1],
    ]

    const upload = await this.client(worker).post('/time', [sent])
    expect(upload.status).to.equal(200)
    const [row] = upload.data
    expect(row.error).to.equal(undefined)
    expect(row.locationsAccepted).to.equal(true)
    expect(row.appsAccepted).to.equal(true)
    // The answer does not echo the points back.
    expect(row.locations).to.equal(undefined)
    expect((await this.entry(row.id)).locationStatus).to.equal('ok')

    const read = await this.client(worker).get(`/time/${row.id}`)
    expect(read.status).to.equal(200)
    expect(read.data.locationStatus).to.equal('ok')
    expect(read.data.locations).to.have.length(3)
    expect(
      read.data.locations.map(
        (point: { latitude: number | null; mock: boolean }) => [
          point.latitude,
          point.mock,
        ],
      ),
    ).to.deep.equal([
      [52.37, true],
      [null, false],
      [52.38, false],
    ])
    // An attempt with no fix comes back as one, with nothing but its time.
    expect(read.data.locations[1]).to.include({
      latitude: null,
      longitude: null,
      accuracy: null,
    })
    expect(
      read.data.locations.map((point: { at: string }) => Date.parse(point.at)),
    ).to.deep.equal(
      [1, 2, 3].map((minute) =>
        moment(sent.fromAt).add(minute, 'minutes').valueOf(),
      ),
    )

    const listed = await this.client(worker).post('/time/search', {
      filter: { projectId: project.id },
      sort: { fromAt: 'ASC' },
      page: 0,
    })
    expect(listed.data[0][0].locations).to.have.length(3)
  }

  @test() async pointsAProjectDidNotAskForAreNotStored() {
    const { worker, project } = await this.world({ trackLocation: false })

    const upload = await this.client(worker).post('/time', [
      this.slice(project, 1),
    ])
    const [row] = upload.data
    expect(row.error).to.equal(undefined)
    expect(row.locationsAccepted).to.equal(false)
    expect((await this.entry(row.id)).locationStatus).to.equal('off')
    expect(await this.points(row.id)).to.have.length(0)
  }

  @test() async aDesktopSliceHasNoLocationWhateverItSends() {
    const { worker, project } = await this.world()

    const upload = await this.client(worker).post('/time', [
      this.slice(project, 1, { source: undefined, keyboardKeys: 3 }),
    ])
    const [row] = upload.data
    expect(row.error).to.equal(undefined)
    expect(row).to.not.have.property('locationsAccepted')
    expect(await this.entry(row.id)).to.include({
      source: 'desktop',
      locationStatus: null,
    })
    expect(await this.points(row.id)).to.have.length(0)
  }

  @test() async unreadableLocationNeverCostsTheTime() {
    const { worker, project } = await this.world()
    const fine = { latitude: 1, longitude: 2, accuracy: 3 }
    // Each is wrong in one way, against its own slice's start.
    const broken: ((start: moment.Moment) => object)[] = [
      () => ({ locationStatus: 'sometimes' }),
      () => ({ locationStatus: 'off' }),
      () => ({ locations: 'here' }),
      (start) => ({
        locations: [this.fix(start, 1, { ...fine, latitude: 91 })],
      }),
      (start) => ({
        locations: [this.fix(start, 1, { ...fine, longitude: null })],
      }),
      (start) => ({
        locations: [this.fix(start, 1, { ...fine, latitude: '1' })],
      }),
      (start) => ({
        locations: [this.fix(start, 1, { ...fine, accuracy: -1 })],
      }),
      (start) => ({
        locations: [{ ...this.fix(start, 1, fine), at: 'yesterday' }],
      }),
      (start) => ({ locations: [this.fix(start, 30, fine)] }),
      (start) => ({ locations: [this.fix(start, 1, { ...fine, mock: 'no' })] }),
    ]

    const upload = await this.client(worker).post(
      '/time',
      broken.map((wrong, index) => {
        const endsAgo = 1 + 10 * index
        const start = moment()
          .subtract(endsAgo + 10, 'minutes')
          .startOf('minute')
        return this.slice(project, endsAgo, wrong(start))
      }),
    )
    expect(upload.status).to.equal(200)
    for (const [index, row] of upload.data.entries()) {
      const label = String(broken[index])
      expect(row.error, label).to.equal(undefined)
      expect(row.locationsAccepted, label).to.equal(false)
      expect(await this.entry(row.id), label).to.include({
        source: 'mobile',
        minutesActive: 10,
        locationStatus: 'invalid',
      })
      expect(await this.points(row.id), label).to.have.length(0)
    }
  }

  @test() async aSliceWithoutLocationSaysWhy() {
    const { worker, project } = await this.world()

    const upload = await this.client(worker).post('/time', [
      this.slice(project, 1, { locationStatus: 'off', locations: [] }),
      this.slice(project, 11, {
        locationStatus: 'permission_missing',
        locations: undefined,
      }),
      this.slice(project, 21, {
        locationStatus: undefined,
        locations: undefined,
      }),
    ])
    const statuses = await Promise.all(
      upload.data.map(
        async (row: { id: string }) =>
          (await this.entry(row.id)).locationStatus,
      ),
    )
    expect(statuses).to.deep.equal(['off', 'permission_missing', null])
    expect(
      upload.data.map(
        (row: { locationsAccepted: boolean }) => row.locationsAccepted,
      ),
    ).to.deep.equal([false, false, false])
  }

  @test() async locationIsBlankedWhereverDetailIs() {
    const { owner, worker, viewer, project } = await this.world()
    const [{ id }] = (
      await this.client(worker).post('/time', [this.slice(project, 1)])
    ).data

    // Under review, the owner hears that detail is coming, and no more.
    const held = await this.client(owner).get(`/time/${id}`)
    expect(held.status).to.equal(200)
    expect(held.data.detailPendingReview).to.equal(true)
    expect(held.data.locations).to.equal(undefined)
    const heldList = await this.client(owner).post('/time/search', {
      filter: { projectId: project.id },
      sort: { fromAt: 'ASC' },
      page: 0,
    })
    expect(heldList.data[0][0].locations).to.equal(undefined)

    // A viewer reads totals only, never an entry.
    expect((await this.client(viewer).get(`/time/${id}`)).status).to.not.equal(
      200,
    )
    const viewerList = await this.client(viewer).post('/time/search', {
      filter: { projectId: project.id },
      sort: { fromAt: 'ASC' },
      page: 0,
    })
    expect(viewerList.data[0]).to.have.length(0)

    expect(
      (await this.client(worker).post('/time/publish', { ids: [id] })).status,
    ).to.equal(200)
    const published = await this.client(owner).get(`/time/${id}`)
    expect(published.data.locations).to.have.length(3)
  }

  @test() async aPublishedSliceKeepsItsLocation() {
    const { worker, project } = await this.world()
    const client = this.client(worker)
    const sent = this.slice(project, 1)
    const [{ id }] = (await client.post('/time', [sent])).data
    expect((await client.post('/time/publish', { ids: [id] })).status).to.equal(
      200,
    )

    const retry = await client.post('/time', [
      { ...sent, locations: [sent.locations[0]] },
    ])
    expect(retry.data[0].error).to.equal(undefined)
    expect(retry.data[0].locationsAccepted).to.equal(true)
    expect(await this.points(id)).to.have.length(3)
  }

  @test() async anUnpublishedRetryReplacesItsFixes() {
    const { worker, project } = await this.world()
    const client = this.client(worker)
    const sent = this.slice(project, 1)
    const [{ id }] = (await client.post('/time', [sent])).data

    const retry = await client.post('/time', [
      { ...sent, locations: [sent.locations[2]] },
    ])
    expect(retry.data[0].id).to.equal(id)
    const points = await this.points(id)
    expect(points.map((point) => point.latitude)).to.deep.equal([52.38])
  }

  @test() async removingTheSliceRemovesItsFixes() {
    const { worker, project } = await this.world()
    const client = this.client(worker)
    const [{ id }] = (await client.post('/time', [this.slice(project, 1)])).data

    expect(
      (await client.delete('/time', { data: { ids: [id] } })).status,
    ).to.equal(200)
    expect(await this.points(id)).to.have.length(0)
  }
}
