import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import axios from 'axios'
import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { App } from '@/app/app'
import { User } from '@/entity/user'
import { ITeam, ITeamPerson } from '@/model/team'

const NEVER_SIGNED_IN = 'never-signed-in@example.com'

@suite()
export class TeamControllerTest extends BaseControllerTest {
  private client(user: User) {
    return axios.create({
      baseURL: `${this.url}/api`,
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      validateStatus: () => true,
    })
  }

  private async read(user: User): Promise<ITeam> {
    const response = await this.client(user).get('/team')
    expect(response.status).to.equal(200)
    return response.data as ITeam
  }

  private async addAgent(user: User, projectId: string, rateHourCents: number) {
    const client = this.client(user)
    const agent = (
      await client.post('/agents', {
        name: 'My Codex',
        slug: 'my-codex',
        product: 'codex',
        isDefault: true,
        bindings: [],
      })
    ).data as { id: string }
    const attached = await client.put(
      `/project/${projectId}/agents/${agent.id}`,
      {
        rateHourCents,
      },
    )
    expect(attached.status).to.equal(200)
    return agent.id
  }

  private async scenario() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const other = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    project.workerAddresses = [worker.address, other.address, NEVER_SIGNED_IN]
    project.viewerAddresses = [viewer.address]
    project.trackAgents = true
    await App.conn.manager.save(project)
    return { owner, worker, other, viewer, project }
  }

  private static person(team: ITeam, address: string): ITeamPerson {
    const person = team.projects[0].people.find((p) => p.address === address)
    expect(person, address).to.exist
    return person as ITeamPerson
  }

  @test()
  async 'lists everyone on the project, signed in or not'() {
    const { owner, worker, viewer } = await this.scenario()
    const team = await this.read(owner)
    expect(team.viewerOnly).to.equal(false)
    expect(team.projects).to.have.length(1)
    expect(team.projects[0].role).to.equal('owner')
    expect(team.projects[0].people.map((p) => p.role)).to.deep.equal([
      'owner',
      'worker',
      'worker',
      'worker',
      'viewer',
    ])
    expect(TeamControllerTest.person(team, worker.address).userId).to.equal(
      worker.id,
    )
    expect(TeamControllerTest.person(team, viewer.address).userId).to.equal(
      viewer.id,
    )
    expect(TeamControllerTest.person(team, NEVER_SIGNED_IN).userId).to.equal(
      null,
    )
  }

  @test()
  async 'an owner sees every worker agent and its latest rate change'() {
    const { owner, worker, project } = await this.scenario()
    const agentId = await this.addAgent(worker, project.id, 600)
    await this.client(worker).put(`/project/${project.id}/agents/${agentId}`, {
      rateHourCents: 900,
    })
    const [agent] = TeamControllerTest.person(
      await this.read(owner),
      worker.address,
    ).agents
    expect(agent.id).to.equal(agentId)
    expect(agent.name).to.equal('My Codex')
    expect(agent.rateHourCents).to.equal(900)
    expect(agent.lastRateChange?.fromCents).to.equal(600)
    expect(agent.lastRateChange?.toCents).to.equal(900)
  }

  @test()
  async 'a worker sees the people but only their own agents'() {
    const { worker, other, project } = await this.scenario()
    await this.addAgent(worker, project.id, 600)
    await this.addAgent(other, project.id, 700)
    const team = await this.read(worker)
    expect(team.projects[0].role).to.equal('worker')
    expect(team.projects[0].people).to.have.length(5)
    expect(
      TeamControllerTest.person(team, worker.address).agents[0].rateHourCents,
    ).to.equal(600)
    expect(TeamControllerTest.person(team, other.address).agents).to.deep.equal(
      [],
    )
  }

  @test()
  async 'a person who is only ever a viewer gets no project'() {
    const { viewer } = await this.scenario()
    expect(await this.read(viewer)).to.deep.equal({
      viewerOnly: true,
      projects: [],
    })
  }

  @test()
  async 'someone on no list is not told they are a viewer'() {
    await this.scenario()
    const outsider = await this.userFixture.createUser()
    expect(await this.read(outsider)).to.deep.equal({
      viewerOnly: false,
      projects: [],
    })
  }

  @test()
  async 'a viewer on one project sees only the one they work on'() {
    const { owner, viewer, project } = await this.scenario()
    const worked = await this.projectFixture.createPersonal(owner, 60)
    worked.workerAddresses = [viewer.address]
    await App.conn.manager.save(worked)
    const team = await this.read(viewer)
    expect(team.viewerOnly).to.equal(false)
    expect(team.projects.map((p) => p.id)).to.deep.equal([worked.id])
    expect(team.projects.map((p) => p.id)).to.not.include(project.id)
  }

  @test()
  async 'a detached agent leaves the project'() {
    const { owner, worker, project } = await this.scenario()
    const agentId = await this.addAgent(worker, project.id, 600)
    await this.client(worker).delete(`/project/${project.id}/agents/${agentId}`)
    expect(
      TeamControllerTest.person(await this.read(owner), worker.address).agents,
    ).to.deep.equal([])
  }

  @test()
  async 'the owner cannot change a worker rate'() {
    const { owner, worker, project } = await this.scenario()
    const agentId = await this.addAgent(worker, project.id, 600)
    const response = await this.client(owner).put(
      `/project/${project.id}/agents/${agentId}`,
      { rateHourCents: 1 },
    )
    expect(response.status).to.equal(403)
    const [agent] = TeamControllerTest.person(
      await this.read(owner),
      worker.address,
    ).agents
    expect(agent.rateHourCents).to.equal(600)
  }

  @test()
  async 'a collaborator of a lapsed owner sees nothing of that project'() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    project.workerAddresses = [worker.address]
    await App.conn.manager.save(project)
    expect((await this.read(worker)).projects).to.deep.equal([])
    expect((await this.read(owner)).projects).to.have.length(1)
  }
}
