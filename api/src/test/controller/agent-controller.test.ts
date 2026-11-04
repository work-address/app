import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import axios from 'axios'
import { randomUUID } from 'crypto'
import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { App } from '@/app/app'
import { User } from '@/entity/user'
import { AgentCredential } from '@/entity/agent-credential'
import { AgentEvent } from '@/entity/agent-event'
import { TimeAgent } from '@/entity/time-agent'

@suite()
export class AgentControllerTest extends BaseControllerTest {
  private previousFlag: string | undefined
  async before() {
    this.previousFlag = process.env.AGENT_TRACKING_ENABLED
    // the default: on unless switched off
    delete process.env.AGENT_TRACKING_ENABLED
    await super.before()
  }
  async after() {
    if (this.previousFlag === undefined)
      delete process.env.AGENT_TRACKING_ENABLED
    else process.env.AGENT_TRACKING_ENABLED = this.previousFlag
    await super.after()
  }
  private client(user: User | string) {
    return axios.create({
      baseURL: `${this.url}/api`,
      headers: {
        Authorization:
          typeof user === 'string'
            ? `Bearer ${user}`
            : this.authenticator.getTokens(user).accessToken,
      },
      validateStatus: () => true,
    })
  }
  private async scenario(mode: 'timer' | 'fixed' = 'timer') {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    project.workerAddresses = [worker.address]
    project.viewerAddresses = [viewer.address]
    project.trackAgents = true
    await App.conn.manager.save(project)
    const client = this.client(worker)
    const agent = (
      await client.post('/agents', {
        name: 'My Codex',
        slug: 'my-codex',
        product: 'codex',
        isDefault: true,
        bindings: [],
      })
    ).data
    expect(agent).to.have.property('id')
    expect(
      (
        await client.put(`/project/${project.id}/agents/${agent.id}`, {
          rateHourCents: 600,
        })
      ).status,
    ).to.equal(200)
    const instanceId = randomUUID()
    const issued = await client.post('/agent-tracking/credentials', {
      instanceId,
      mode,
    })
    expect(issued.status).to.equal(201)
    const uploader = this.client(issued.data.credential)
    const epoch = randomUUID()
    const start = Date.now() - 300000
    const event = (
      eventType: string,
      sequence: number,
      offset: number,
      extra = {},
    ) => ({
      schemaVersion: 1,
      eventId: randomUUID(),
      source: {
        product: 'codex',
        surface: 'cli',
        instanceId,
        adapterVersion: '0.1.0',
        runtimeVersion: 'synthetic-test',
        epoch,
        sequence,
      },
      projectId: project.id,
      sessionId: 'session',
      runId: 'run',
      agentId: 'root',
      occurredAt: new Date(start + offset).toISOString(),
      observedAt: new Date(start + offset).toISOString(),
      clock: { basis: 'source_wall' },
      capabilities: {
        runBoundaries: true,
        externalWaits: 'complete',
        replay: true,
      },
      eventType,
      ...extra,
    })
    return {
      owner,
      worker,
      viewer,
      project,
      client,
      agent,
      issued: issued.data,
      uploader,
      event,
    }
  }
  @test() async collectorSecretsAreWriteOnlyPrivateAndRevocable() {
    const s = await this.scenario()
    const stored = await App.conn.manager.findOneByOrFail(AgentCredential, {
      id: s.issued.id,
    })
    expect(stored.secretHash).not.to.equal(s.issued.credential)
    const metadata = (await s.client.get('/agent-tracking/credentials')).data
    expect(JSON.stringify(metadata)).not.to.contain(s.issued.credential)
    expect(metadata[0]).not.to.have.property('secretHash')
    expect((await s.uploader.post('/project/search', {})).status).to.equal(401)
    expect(
      (
        await s.client.post('/agent-tracking/events', {
          events: [s.event('run.started', 0, 0)],
        })
      ).status,
    ).to.equal(401)
    expect(
      (
        await this.client(s.owner).delete(
          `/agent-tracking/credentials/${s.issued.id}`,
        )
      ).status,
    ).to.equal(404)
    expect(
      (await s.client.delete(`/agent-tracking/credentials/${s.issued.id}`))
        .status,
    ).to.equal(204)
    expect(
      (
        await s.uploader.post('/agent-tracking/events', {
          events: [s.event('run.started', 0, 0)],
        })
      ).status,
    ).to.equal(401)
    expect(
      JSON.stringify(
        (await this.client(s.owner).get(`/user/${s.worker.address}/address`))
          .data,
      ),
    ).not.to.contain('My Codex')
  }
  @test() async ingestionIsOnUnlessSwitchedOff() {
    const s = await this.scenario()
    process.env.AGENT_TRACKING_ENABLED = 'false'
    const off = await s.uploader.post('/agent-tracking/events', {
      events: [s.event('run.started', 0, 0)],
    })
    expect(off.status).to.equal(503)
    // credentials still issue while ingestion is off
    expect(
      (
        await s.client.post('/agent-tracking/credentials', {
          instanceId: randomUUID(),
          mode: 'timer',
        })
      ).status,
    ).to.equal(201)
    delete process.env.AGENT_TRACKING_ENABLED
    const on = await s.uploader.post('/agent-tracking/events', {
      events: [s.event('run.started', 0, 0)],
    })
    expect(on.status).to.equal(200)
  }
  @test() async invalidEnvelopeAndScopeCannotCreateRecords() {
    const s = await this.scenario('fixed')
    const secretText = 'private prompt that must not be echoed'
    expect(
      (
        await s.uploader.post('/agent-tracking/events', {
          events: [{ ...s.event('run.completed', 0, 0), prompt: secretText }],
        })
      ).status,
    ).to.equal(400)
    const badJson = await s.uploader.post(
      '/agent-tracking/events',
      `{"events": ${secretText}`,
      { headers: { 'Content-Type': 'application/json' } },
    )
    expect(badJson.status).to.equal(400)
    expect(JSON.stringify(badJson.data)).not.to.contain(secretText)
    expect(
      (
        await s.uploader.post('/agent-tracking/events', {
          events: [s.event('tracking.paused', 1, 1000, { reason: 'idle' })],
        })
      ).status,
    ).to.equal(403)
    const unknown = await s.uploader.post('/agent-tracking/events', {
      events: [s.event('run.started', 0, 0, { projectId: randomUUID() })],
    })
    expect(unknown.status).to.equal(200)
    expect(unknown.data.results[0].code).to.equal('PROJECT_UNAVAILABLE')
    expect(
      (
        await s.uploader.post('/agent-tracking/events', {
          events: [],
          padding: 'x'.repeat(1024 * 1024),
        })
      ).status,
    ).to.equal(413)
    expect(await App.conn.manager.count(AgentEvent)).to.equal(0)
  }
  @test() async onlyTheWorkerMayReadOrChangeTheirAttachments() {
    const s = await this.scenario()
    expect(
      (
        await this.client(s.owner).put(
          `/project/${s.project.id}/agents/${s.agent.id}`,
          { rateHourCents: 1 },
        )
      ).status,
    ).to.equal(403)
    expect(
      (await this.client(s.viewer).get(`/project/${s.project.id}/agents`))
        .status,
    ).to.equal(403)
  }
  @test() async aPromptIsRemovedThroughItsRun() {
    const s = await this.scenario()
    await s.uploader.post('/agent-tracking/events', {
      events: [s.event('run.started', 0, 0, { prompt: 'Fix the login bug' })],
    })
    const search = () =>
      s.client.post('/agent-tracking/search', { projectId: s.project.id })
    const { runKey } = (await search()).data[0][0]
    const path = `/agent-tracking/runs/${runKey}/prompt`

    expect(
      (await s.client.delete('/agent-tracking/runs/not-a-run/prompt')).status,
    ).to.equal(400)
    expect((await this.client(s.owner).delete(path)).status).to.equal(403)
    expect((await s.client.delete(path)).status).to.equal(204)
    expect((await search()).data[0][0].prompt).to.equal(null)
  }

  @test() async aBatchIsAcknowledgedAndItsRunsAreSearchable() {
    const s = await this.scenario()
    const events = [
      s.event('run.started', 0, 0, { prompt: 'Fix the login bug' }),
      s.event('run.completed', 1, 180000),
    ]
    const uploaded = await s.uploader.post('/agent-tracking/events', { events })
    expect(uploaded.status).to.equal(200)
    expect(uploaded.data.results).to.deep.equal(
      events.map((event) => ({ eventId: event.eventId, status: 'accepted' })),
    )
    const runs = await s.client.post('/agent-tracking/search', {
      projectId: s.project.id,
    })
    expect(runs.status).to.equal(200)
    expect(runs.data[1]).to.equal(1)
    expect(runs.data[0][0].prompt).to.equal('Fix the login bug')
    expect(
      (
        await this.client(s.viewer).post('/agent-tracking/search', {
          projectId: s.project.id,
        })
      ).status,
    ).to.equal(403)
    expect(
      (
        await s.client.post('/agent-tracking/search', {
          fromAt: new Date(2000).toISOString(),
          toAt: new Date(1000).toISOString(),
        })
      ).status,
    ).to.equal(400)
  }
  @test() async healthCannotExtendRunsAndIsRateLimited() {
    const s = await this.scenario()
    const health = { queued: 0, rejected: 1, lost: 2, heldRuns: 3 }
    expect(
      (await s.uploader.post('/agent-tracking/events', { events: [], health }))
        .status,
    ).to.equal(200)
    expect(await App.conn.manager.count(TimeAgent)).to.equal(0)
    const retry = await s.uploader.post('/agent-tracking/events', {
      events: [],
      health,
    })
    expect(retry.status).to.equal(429)
    expect(retry.headers['retry-after']).to.equal('20')
    expect(
      (await s.client.get('/agent-tracking/status')).data.credentials[0].health,
    ).to.deep.equal(health)
  }
  @test() async agentDefaultsAndBindingsAreUniqueAndProductsAreImmutable() {
    const s = await this.scenario()
    const payload = {
      name: 'Second Codex',
      slug: 'second',
      product: 'codex',
      isDefault: true,
      bindings: [s.issued.instanceId],
    }
    const second = await s.client.post('/agents', payload)
    expect(second.status).to.equal(201)
    expect(
      (await s.client.get('/agents')).data.filter(
        (a: { isDefault: boolean }) => a.isDefault,
      ),
    ).to.have.length(1)
    expect(
      (
        await s.client.put('/agents', {
          ...payload,
          id: s.agent.id,
          slug: 'my-codex',
        })
      ).status,
    ).to.equal(400)
    expect(
      (
        await s.client.put('/agents', {
          ...payload,
          id: second.data.id,
          product: 'hermes',
        })
      ).status,
    ).to.equal(400)
    expect(
      (await s.client.delete('/agents', { data: { id: second.data.id } }))
        .status,
    ).to.equal(204)
    const remaining = (await s.client.get('/agents')).data
    expect(
      remaining.find((a: { id: string }) => a.id === s.agent.id).isDefault,
    ).to.equal(true)
    expect(
      remaining.find((a: { id: string }) => a.id === second.data.id).removedAt,
    ).to.be.a('string')
  }
  @test() async ordinaryProjectEditsCannotOverwritePrivateAttachments() {
    const s = await this.scenario()
    const owner = this.client(s.owner)
    expect(
      (await owner.get(`/project/${s.project.id}`)).data.agents,
    ).to.have.length(1)
    expect(
      (await this.client(s.viewer).get(`/project/${s.project.id}`)).data.agents,
    ).to.deep.equal([])
    const edit = {
      title: s.project.title,
      text: s.project.text,
      state: s.project.state,
      agents: [],
      agentAttachments: [],
      trackAgents: false,
    }
    expect((await owner.put(`/project/${s.project.id}`, edit)).status).to.equal(
      200,
    )
    expect(
      (await owner.get(`/project/${s.project.id}/agents`)).data,
    ).to.have.length(1)
    expect(
      (
        await owner.put(`/project/${s.project.id}`, {
          ...edit,
          trackAgents: true,
        })
      ).status,
    ).to.equal(200)
    // Re-enabling accepts only new starts, never an old run's backlog.
    expect(
      (
        await s.uploader.post('/agent-tracking/events', {
          events: [s.event('run.started', 0, 0)],
        })
      ).data.results[0].code,
    ).to.equal('AGENT_TRACKING_OFF')
  }
}
