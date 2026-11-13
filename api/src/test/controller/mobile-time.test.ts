import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import axios from 'axios'

import { App } from '@/app/app'
import { Project } from '@/entity/project'
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
}
