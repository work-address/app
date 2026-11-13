import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import axios from 'axios'

import { App } from '@/app/app'
import { Project } from '@/entity/project'
import { Time } from '@/entity/time'
import { User } from '@/entity/user'
import { BaseControllerTest } from '@/test/controller/base-controller.test'

/**
 * Phone time over HTTP, as the phone and the web app reach it
 * (time-tracker/docs/android-server.md, step 1).
 */
@suite()
export class MobileTimeTest extends BaseControllerTest {
  private client(user: User) {
    return axios.create({
      baseURL: `${this.url}/api`,
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      validateStatus: () => true,
    })
  }

  private async world() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    project.workerAddresses = [worker.address]
    await App.conn.manager.save(project)

    return { owner, worker, project }
  }

  private stored(project: Project) {
    return App.conn.manager.findOneByOrFail(Project, { id: project.id })
  }

  /** The project as the tracker's project list returns it to `user`. */
  private async listed(project: Project, user: User) {
    const response = await this.client(user).post('/project/search', {
      filter: {},
      sort: { createdAt: 'ASC' },
      page: 0,
    })
    expect(response.status).to.equal(200)

    return (response.data[0] as Project[]).find((row) => row.id === project.id)
  }

  /** One ten-minute bucket ending `endsAgo` minutes ago, as a tracker sends it. */
  private item(project: Project, endsAgo: number, fields: object = {}) {
    const end = Date.now() - endsAgo * 60000

    return {
      projectId: project.id,
      fromAt: new Date(end - 600000).toISOString(),
      toAt: new Date(end).toISOString(),
      fromIndex: 0,
      toIndex: 1,
      note: '',
      keyboardKeys: 4,
      mouseKeys: 2,
      mouseDistance: 9,
      minutesActive: 10,
      ...fields,
    }
  }

  private async allow(owner: User, project: Project, allowMobileTime = true) {
    const edit = await this.client(owner).put(`/project/${project.id}`, {
      allowMobileTime,
    })
    expect(edit.status).to.equal(200)
  }

  private entry(id: string) {
    return App.conn.manager.findOneByOrFail(Time, { id })
  }

  @test() async phoneTrackingIsOffUntilTheOwnerTurnsItOn() {
    const { owner, worker, project } = await this.world()

    expect((await this.stored(project)).allowMobileTime).to.equal(false)
    expect((await this.listed(project, worker))?.allowMobileTime).to.equal(
      false,
    )

    const edit = await this.client(owner).put(`/project/${project.id}`, {
      allowMobileTime: true,
    })
    expect(edit.status).to.equal(200)
    expect((await this.listed(project, worker))?.allowMobileTime).to.equal(true)
  }

  @test() async onlyTheOwnerSetsTheSwitch() {
    const { worker, project } = await this.world()

    const edit = await this.client(worker).put(`/project/${project.id}`, {
      allowMobileTime: true,
    })
    expect(edit.status).to.equal(403)
    expect((await this.stored(project)).allowMobileTime).to.equal(false)
  }

  @test() async theSwitchMustBeABoolean() {
    const { owner, project } = await this.world()

    for (const allowMobileTime of ['true', null, 1]) {
      const edit = await this.client(owner).put(`/project/${project.id}`, {
        allowMobileTime,
      })
      expect(edit.status, String(allowMobileTime)).to.equal(400)
    }
    expect((await this.stored(project)).allowMobileTime).to.equal(false)
  }

  @test() async theServerRemembersWhenTheSwitchLastWentOff() {
    const { owner, project } = await this.world()
    const client = this.client(owner)
    const set = (body: object) => client.put(`/project/${project.id}`, body)

    expect((await set({ allowMobileTime: true })).status).to.equal(200)
    expect((await this.stored(project)).mobileTimeOffAt).to.equal(null)

    const before = Date.now()
    expect((await set({ allowMobileTime: false })).status).to.equal(200)
    const off = (await this.stored(project)).mobileTimeOffAt
    expect(off).to.be.instanceOf(Date)
    expect(off!.getTime()).to.be.within(before - 1000, Date.now() + 1000)

    // Turning it on again, editing anything else, or sending the field keeps
    // the last switch as it was.
    expect((await set({ allowMobileTime: true })).status).to.equal(200)
    expect((await set({ title: 'Renamed' })).status).to.equal(200)
    expect(
      (await set({ mobileTimeOffAt: new Date(0).toISOString() })).status,
    ).to.equal(200)
    const kept = await this.stored(project)
    expect(kept.allowMobileTime).to.equal(true)
    expect(kept.mobileTimeOffAt?.getTime()).to.equal(off!.getTime())
  }

  @test() async aNewProjectStartsWithNoSwitchHistory() {
    const owner = await this.userFixture.createPremiumUser()
    const response = await this.client(owner).post('/project', {
      title: 'Phone project',
      text: 'Cleaning',
      state: 'Active',
      allowMobileTime: true,
    })
    expect(response.status).to.equal(201)
    const id = String(response.headers.location).split('/').pop()
    const created = await App.conn.manager.findOneByOrFail(Project, { id })
    expect(created.allowMobileTime).to.equal(true)
    expect(created.mobileTimeOffAt).to.equal(null)
  }

  @test() async aPhoneEntryIsStoredAsPhoneTimeWhereTheProjectAllowsIt() {
    const { owner, worker, project } = await this.world()
    project.trackScreenshots = true
    project.trackProcesses = true
    await App.conn.manager.save(project)
    await this.allow(owner, project)

    const upload = await this.client(worker).post('/time', [
      this.item(project, 1, {
        source: 'mobile',
        screenshot: 'data:image/png;base64,AAAA',
        processes: [{ name: 'Editor', timeMin: 10 }],
        appsStatus: 'ok',
        apps: [{ name: 'Editor', seconds: 600 }],
      }),
      this.item(project, 11),
    ])
    expect(upload.status).to.equal(200)
    const [phone, desktop] = upload.data
    expect(phone.error).to.equal(undefined)
    expect(phone.source).to.equal('mobile')
    expect(desktop.error).to.equal(undefined)

    // Phone time carries none of the desktop's detail, whatever was sent.
    expect(await this.entry(phone.id)).to.include({
      source: 'mobile',
      minutesActive: 10,
      keyboardKeys: 0,
      mouseKeys: 0,
      mouseDistance: 0,
      screenshot: null,
      processes: null,
      appsStatus: 'unsupported',
      appsReason: 'mobile',
    })
    expect(await this.entry(desktop.id)).to.include({
      source: 'desktop',
      keyboardKeys: 4,
    })

    const listed = await this.client(worker).post('/time/search', {
      filter: { projectId: project.id, source: 'mobile' },
      sort: { fromAt: 'ASC' },
      page: 0,
    })
    expect(listed.status).to.equal(200)
    expect(
      listed.data[0].map((row: Time) => [row.id, row.source]),
    ).to.deep.equal([[phone.id, 'mobile']])
  }

  @test() async aPhoneEntryIsRefusedAloneWhereTheProjectDoesNotAllowIt() {
    const { worker, project } = await this.world()

    const upload = await this.client(worker).post('/time', [
      this.item(project, 1, { source: 'mobile' }),
      this.item(project, 11),
    ])
    expect(upload.status).to.equal(200)
    const [phone, desktop] = upload.data
    expect(phone.id).to.equal(undefined)
    expect(phone.error).to.include({ name: 'MobileTimeNotAllowedException' })
    expect(desktop.error).to.equal(undefined)
    expect(await this.entry(desktop.id)).to.include({ source: 'desktop' })
    expect(
      await App.conn.manager.countBy(Time, {
        project: { id: project.id },
        source: 'mobile',
      }),
    ).to.equal(0)
  }

  @test() async anyOtherSourceIsADesktopUpload() {
    const { worker, project } = await this.world()

    const sources = ['manual', 'web', 'desktop', 'MOBILE', 7, null, undefined]
    const upload = await this.client(worker).post(
      '/time',
      sources.map((source, index) =>
        this.item(project, 1 + 10 * index, { source }),
      ),
    )
    expect(upload.status).to.equal(200)
    for (const [index, row] of upload.data.entries()) {
      expect(row.error, String(sources[index])).to.equal(undefined)
      expect(await this.entry(row.id)).to.include({
        source: 'desktop',
        keyboardKeys: 4,
      })
    }
  }

  @test() async phoneTimeFromBeforeTheSwitchWentOffIsStillTaken() {
    const { owner, worker, project } = await this.world()
    await this.allow(owner, project)
    await this.allow(owner, project, false)
    // When the owner turned it off, set back so both sides of it are past.
    await App.conn.manager.update(Project, project.id, {
      mobileTimeOffAt: new Date(Date.now() - 30 * 60000),
    })

    const upload = await this.client(worker).post('/time', [
      this.item(project, 50, { source: 'mobile' }),
      this.item(project, 10, { source: 'mobile' }),
    ])
    expect(upload.status).to.equal(200)
    const [before, after] = upload.data
    expect(before.error).to.equal(undefined)
    expect(await this.entry(before.id)).to.include({ source: 'mobile' })
    expect(after.error).to.include({ name: 'MobileTimeNotAllowedException' })
  }

  @test() async aPublishedEntryKeepsItsSource() {
    const { owner, worker, project } = await this.world()
    await this.allow(owner, project)
    const client = this.client(worker)
    const desktop = this.item(project, 1, { minutesActive: 10 })
    const [{ id }] = (await client.post('/time', [desktop])).data
    expect((await client.post('/time/publish', { ids: [id] })).status).to.equal(
      200,
    )

    const retry = await client.post('/time', [{ ...desktop, source: 'mobile' }])
    expect(retry.data[0].error).to.equal(undefined)
    expect(await this.entry(id)).to.include({
      source: 'desktop',
      keyboardKeys: 4,
    })
  }

  @test() async phoneTimeIsInvoicedAsTrackedTimeNotManual() {
    const { owner, worker, project } = await this.world()
    await this.allow(owner, project)
    const client = this.client(worker)
    const upload = await client.post('/time', [
      this.item(project, 1, { source: 'mobile', minutesActive: 10 }),
      this.item(project, 11, { minutesActive: 6 }),
    ])
    const ids = upload.data.map((row: { id: string }) => row.id)

    const invoice = await client.post(`/invoice/project/${project.id}`, {
      timeIds: ids,
    })
    expect(invoice.status).to.equal(200)
    expect(invoice.data.amountCents).to.equal(2000)
    expect(invoice.data.lines[0]).to.include({
      basis: 'tracked',
      minutes: 20,
      mobileMinutes: 10,
      manualMinutes: 0,
      activeMinutes: 6,
    })
  }
}
