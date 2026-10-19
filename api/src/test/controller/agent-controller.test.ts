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
import { EInvoiceState } from '@/model/invoice'

@suite()
export class AgentControllerTest extends BaseControllerTest {
  private previousFlag: string | undefined
  async before() {
    this.previousFlag = process.env.AGENT_TRACKING_ENABLED
    process.env.AGENT_TRACKING_ENABLED = 'true'
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
  @test() async lifecycleReplayPausesAndVisibilityAreScoped() {
    const s = await this.scenario()
    const events = [
      s.event('run.started', 0, 0),
      s.event('tracking.paused', 1, 60000, { reason: 'idle' }),
      s.event('tracking.resumed', 2, 120000, { reason: 'started' }),
      s.event('run.completed', 3, 180000),
    ]
    const first = await s.uploader.post('/agent-tracking/events', { events })
    expect(first.status).to.equal(200)
    expect(
      first.data.results.map((r: { status: string }) => r.status),
    ).to.deep.equal(events.map(() => 'accepted'))
    const duplicate = await s.uploader.post('/agent-tracking/events', {
      events: [...events].reverse(),
    })
    expect(
      duplicate.data.results.every(
        (r: { status: string }) => r.status === 'duplicate',
      ),
    ).to.equal(true)
    const runs = (
      await s.client.post('/agent-tracking/search', { projectId: s.project.id })
    ).data
    expect(runs[1]).to.equal(1)
    expect(
      runs[0][0].segments.map((v: { state: string }) => v.state),
    ).to.deep.equal(['unknown', 'untracked', 'unknown'])
    expect(runs[0][0].measurement.qualification).to.equal('unqualified')
    expect(
      (
        await this.client(s.owner).post('/agent-tracking/search', {
          projectId: s.project.id,
        })
      ).data[1],
    ).to.equal(1)
    expect(
      (
        await this.client(s.viewer).post('/agent-tracking/search', {
          projectId: s.project.id,
        })
      ).status,
    ).to.equal(403)
    const conflict = await s.uploader.post('/agent-tracking/events', {
      events: [{ ...events[0], runId: 'different' }],
    })
    expect(conflict.data.results[0].code).to.equal('EVENT_ID_CONFLICT')
  }
  @test() async terminalBeforeStartIsDurableAndReconcilesAfterRetry() {
    const s = await this.scenario()
    const end = s.event('run.completed', 1, 60000)
    expect(
      (await s.uploader.post('/agent-tracking/events', { events: [end] }))
        .status,
    ).to.equal(200)
    expect(await App.conn.manager.count(TimeAgent)).to.equal(0)
    expect(
      (
        await App.conn.manager.findOneByOrFail(AgentEvent, {
          eventId: end.eventId,
        })
      ).code,
    ).to.equal('MISSING_START')
    expect(
      (
        await s.uploader.post('/agent-tracking/events', {
          events: [s.event('run.started', 0, 0)],
        })
      ).status,
    ).to.equal(200)
    expect(await App.conn.manager.count(TimeAgent)).to.equal(1)
    expect(
      (
        await App.conn.manager.findOneByOrFail(AgentEvent, {
          eventId: end.eventId,
        })
      ).status,
    ).to.equal('processed')
  }

  @test() async contradictoryEvidenceConvergesAcrossUploadBatchBoundaries() {
    const s = await this.scenario('fixed')
    for (const [type, offset, code, extra] of [
      ['run.failed', 60000, 'CONFLICTING_TERMINALS', {}],
      ['run.started', 1000, 'CONFLICTING_STARTS', {}],
      [
        'run.observed',
        1000,
        'CLOCK_REVERSAL',
        { observedState: 'unknown', evidenceKind: 'runtime_state' },
      ],
    ] as const) {
      for (const incremental of [false, true]) {
        const runId = `${code}-${incremental}`
        const events = [
          s.event('run.started', 0, 0, { runId }),
          s.event('run.completed', 1, 60000, { runId }),
          s.event(type, 2, offset, { runId, ...extra }),
        ]
        if (incremental) {
          expect(
            (
              await s.uploader.post('/agent-tracking/events', {
                events: events.slice(0, 2),
              })
            ).status,
          ).to.equal(200)
          expect(
            (
              await App.conn.manager.findOneByOrFail(TimeAgent, {
                sourceRunId: runId,
              })
            ).status,
          ).to.equal('completed')
        }
        const uploaded = await s.uploader.post('/agent-tracking/events', {
          events: incremental ? events.slice(2) : events,
        })
        expect(uploaded.status).to.equal(200)
        expect(
          await App.conn.manager.count(TimeAgent, {
            where: { sourceRunId: runId },
          }),
        ).to.equal(0)
        for (const event of events) {
          expect(
            await App.conn.manager.findOneByOrFail(AgentEvent, {
              eventId: event.eventId,
            }),
          ).to.include({ status: 'quarantined', code })
        }
        expect(
          (
            await s.uploader.post('/agent-tracking/events', {
              events: [...events].reverse(),
            })
          ).data.results.every(
            (r: { status: string }) => r.status === 'duplicate',
          ),
        ).to.equal(true)
      }
    }
    expect(
      (
        await s.client.post('/agent-tracking/search', {
          projectId: s.project.id,
        })
      ).data[1],
    ).to.equal(0)
    const diagnostics = (await s.client.get('/agent-tracking/status')).data
      .diagnostics
    expect(diagnostics).to.have.length(3)
    expect(
      diagnostics.every(
        (d: { status: string; count: number }) =>
          d.status === 'quarantined' && d.count === 6,
      ),
    ).to.equal(true)
  }

  @test() async mixedCaseUuidsKeepBindingsDeduplicationAndRunIdentity() {
    const s = await this.scenario('fixed')
    const binding = s.issued.instanceId.toUpperCase()
    const payload = {
      name: 'Bound Codex',
      slug: 'bound',
      product: 'codex',
      isDefault: false,
      bindings: [binding],
    }
    const created = await s.client.post('/agents', payload)
    expect(created.status).to.equal(201)
    expect(created.data.bindings).to.deep.equal([s.issued.instanceId])
    const id = created.data.id
    expect(
      (await s.client.put('/agents', { ...payload, id: id.toUpperCase() }))
        .status,
    ).to.equal(200)
    expect(
      (
        await s.client.post('/agents', {
          ...payload,
          slug: 'duplicate',
          bindings: [binding.toLowerCase()],
        })
      ).status,
    ).to.equal(400)
    expect(
      (
        await s.client.put('/agents', {
          ...payload,
          id,
          bindings: [binding, binding.toLowerCase()],
        })
      ).status,
    ).to.equal(400)
    expect(
      (
        await s.client.put(
          `/project/${s.project.id.toUpperCase()}/agents/${id.toUpperCase()}`,
          { rateHourCents: 600 },
        )
      ).status,
    ).to.equal(200)
    // Old JSON bindings may still have their original spelling.
    const stored = await App.conn.manager.findOneByOrFail(User, {
      id: s.worker.id,
    })
    stored.agents.find((agent) => agent.id === id)!.bindings = [binding]
    await App.conn.manager.update(User, stored.id, { agents: stored.agents })
    expect(
      (
        await s.client.post('/agents', {
          ...payload,
          slug: 'duplicate-legacy',
          bindings: [binding.toLowerCase()],
        })
      ).status,
    ).to.equal(400)
    const credential = await s.client.post('/agent-tracking/credentials', {
      instanceId: binding,
      mode: 'fixed',
    })
    expect(credential.status).to.equal(201)
    expect(credential.data.instanceId).to.equal(binding.toLowerCase())
    const uploader = this.client(credential.data.credential)
    const raw = s.event('run.started', 0, 0, { runId: 'MixedCaseRun' })
    const start = {
      ...raw,
      eventId: raw.eventId.toUpperCase(),
      projectId: raw.projectId.toUpperCase(),
      source: {
        ...raw.source,
        instanceId: binding,
        epoch: raw.source.epoch.toUpperCase(),
      },
    }
    const retry = {
      ...start,
      eventId: start.eventId.toLowerCase(),
      projectId: start.projectId.toLowerCase(),
      source: {
        ...start.source,
        instanceId: binding.toLowerCase(),
        epoch: start.source.epoch.toLowerCase(),
      },
    }
    const concurrent = await Promise.all([
      uploader.post('/agent-tracking/events', { events: [start] }),
      s.uploader.post('/agent-tracking/events', { events: [retry] }),
    ])
    expect(concurrent.map((r) => r.status)).to.deep.equal([200, 200])
    expect(
      concurrent.map((r) => r.data.results[0].status).sort(),
    ).to.deep.equal(['accepted', 'duplicate'])
    expect(concurrent.map((r) => r.data.results[0].eventId)).to.deep.equal([
      start.eventId,
      retry.eventId,
    ])
    expect(
      (await uploader.post('/agent-tracking/events', { events: [retry] })).data
        .results,
    ).to.deep.equal([{ eventId: retry.eventId, status: 'duplicate' }])
    expect(
      (
        await uploader.post('/agent-tracking/events', {
          events: [
            s.event('run.completed', 1, 60000, { runId: 'MixedCaseRun' }),
          ],
        })
      ).status,
    ).to.equal(200)
    const runs = (
      await s.client.post('/agent-tracking/search', {
        projectId: s.project.id.toUpperCase(),
      })
    ).data
    expect(runs[1]).to.equal(1)
    expect(runs[0][0]).to.include({
      agentId: id,
      status: 'completed',
      sourceInstanceId: binding.toLowerCase(),
      sourceRunId: 'MixedCaseRun',
    })
    expect(await App.conn.manager.count(AgentEvent)).to.equal(2)
    expect(
      (await s.client.delete('/agents', { data: { id: id.toUpperCase() } }))
        .status,
    ).to.equal(204)
  }
  @test() async lateEventsReplayWithPreviouslyStoredUppercaseEpochs() {
    const s = await this.scenario('fixed')
    const start = s.event('run.started', 0, 0)
    const end = s.event('run.completed', 2, 60000)
    expect(
      (
        await s.uploader.post('/agent-tracking/events', {
          events: [start, end],
        })
      ).status,
    ).to.equal(200)
    const before = await App.conn.manager.findOneByOrFail(TimeAgent, {
      sourceRunId: start.runId,
    })
    expect(before.status).to.equal('completed')

    // Recreate the JSON spelling persisted before UUID normalization existed.
    const stored = await App.conn.manager.findBy(AgentEvent, {
      runKey: before.runKey,
    })
    for (const record of stored) {
      record.payload.source.epoch = record.payload.source.epoch.toUpperCase()
      await App.conn.manager.update(AgentEvent, record.id, {
        payload: record.payload,
      })
    }
    const late = s.event('run.observed', 1, 30000, {
      observedState: 'unknown',
      evidenceKind: 'runtime_state',
    })
    for (const status of ['accepted', 'duplicate']) {
      const response = await s.uploader.post('/agent-tracking/events', {
        events: [late],
      })
      expect(response.status).to.equal(200)
      expect(response.data.results).to.deep.equal([
        { eventId: late.eventId, status },
      ])
      const runs = await App.conn.manager.find(TimeAgent)
      expect(runs).to.have.length(1)
      expect(runs[0]).to.include({ id: before.id, status: 'completed' })
      expect(runs[0].fromAt).to.deep.equal(before.fromAt)
      expect(runs[0].toAt).to.deep.equal(before.toAt)
      expect(runs[0].segments).to.deep.equal(before.segments)
    }
    const records = await App.conn.manager.find(AgentEvent)
    expect(records).to.have.length(3)
    expect(
      records.every((r) => r.status === 'processed' && r.code === null),
    ).to.equal(true)
    for (const record of stored) {
      // Canonicalize only the projection input, preserving the original evidence.
      expect(records.find((r) => r.id === record.id)?.payload).to.deep.equal(
        record.payload,
      )
    }
  }

  @test() async invalidEnvelopeAndScopeCannotCreateRecords() {
    const s = await this.scenario('fixed')
    const secretText = 'private prompt that must not be echoed'
    expect(
      (
        await s.uploader.post('/agent-tracking/events', {
          events: [{ ...s.event('run.started', 0, 0), prompt: secretText }],
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
    expect(
      (
        await s.uploader.post('/agent-tracking/events', {
          events: [s.event('run.started', 0, 0, { projectId: randomUUID() })],
        })
      ).status,
    ).to.equal(403)
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
  @test() async policiesMembershipAndDetachAreCheckedOnEveryUpload() {
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
    await s.client.delete(`/project/${s.project.id}/agents/${s.agent.id}`)
    expect(
      (
        await s.uploader.post('/agent-tracking/events', {
          events: [s.event('run.started', 0, 0)],
        })
      ).data.results[0].code,
    ).to.equal('AGENT_NOT_ATTACHED')
    await s.client.put(`/project/${s.project.id}/agents/${s.agent.id}`, {
      rateHourCents: 900,
    })
    const attachments = (await s.client.get(`/project/${s.project.id}/agents`))
      .data
    expect(attachments[0].rateChanges).to.have.length(2)
    s.project.trackAgents = false
    await App.conn.manager.update(s.project.constructor, s.project.id, {
      trackAgents: false,
    })
    expect(
      (
        await s.uploader.post('/agent-tracking/events', {
          events: [s.event('run.started', 0, 0)],
        })
      ).data.results[0].code,
    ).to.equal('AGENT_TRACKING_OFF')
    await App.conn.manager.update(s.project.constructor, s.project.id, {
      trackAgents: true,
      workerAddresses: [],
    })
    expect(
      (
        await s.uploader.post('/agent-tracking/events', {
          events: [s.event('run.started', 0, 0)],
        })
      ).status,
    ).to.equal(403)
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
  @test() async invoiceFreezeQuarantinesLateEventsUntilOwnerRejects() {
    const s = await this.scenario()
    await s.uploader.post('/agent-tracking/events', {
      events: [s.event('run.started', 0, 0)],
    })
    const run = (await App.conn.manager.find(TimeAgent))[0]
    const invoice = await this.invoiceFixture.create(
      s.project,
      0,
      EInvoiceState.REQUESTED,
    )
    await App.conn.manager.update(TimeAgent, run.id, { invoiceId: invoice.id })
    const late = s.event('run.completed', 1, 60000)
    const result = await s.uploader.post('/agent-tracking/events', {
      events: [late],
    })
    expect(result.data.results[0].code).to.equal('RUN_INVOICED')
    expect(
      +(await App.conn.manager.findOneByOrFail(TimeAgent, { id: run.id })).toAt,
    ).to.equal(+run.toAt)
    expect(
      (await this.client(s.owner).post(`/invoice/${invoice.id}/reject`, {}))
        .status,
    ).to.equal(200)
    const corrected = await App.conn.manager.findOneByOrFail(TimeAgent, {
      id: run.id,
    })
    expect(corrected.invoiceId).to.equal(null)
    expect(corrected.status).to.equal('completed')
    expect(+corrected.toAt - +corrected.fromAt).to.equal(60000)
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
  @test() async finishedRunsBillTheirUnionOnTheAgentsOwnLine() {
    const s = await this.scenario('fixed')
    const uploaded = await s.uploader.post('/agent-tracking/events', {
      events: [
        s.event('run.started', 0, 0, { runId: 'a' }),
        s.event('run.completed', 1, 120000, { runId: 'a' }),
        s.event('run.started', 2, 60000, { runId: 'b' }),
        s.event('run.completed', 3, 180000, { runId: 'b' }),
        // Still running: not finished, so it waits for a later invoice.
        s.event('run.started', 4, 295000, { runId: 'open' }),
      ],
    })
    expect(uploaded.status).to.equal(200)
    const first = await App.conn.manager.findOneByOrFail(TimeAgent, {
      sourceRunId: 'a',
    })
    // The worker's own entry overlaps the first 90 s: that part is assisted.
    const human = await s.client.post('/time', [
      {
        projectId: s.project.id,
        fromAt: first.fromAt.toISOString(),
        toAt: new Date(+first.fromAt + 90000).toISOString(),
        fromIndex: 1,
        toIndex: 2,
        note: '',
        keyboardKeys: 1,
        mouseKeys: 0,
        mouseDistance: 0,
        minutesActive: 1,
      },
    ])
    expect(human.data[0].error).to.equal(undefined)

    const invoice = (
      await s.client.post(`/invoice/project/${s.project.id}`, {})
    ).data
    const [humanLine, agentLine] = invoice.lines
    expect(humanLine).to.include({ kind: 'human', minutes: 1.5 })
    // Runs 0-120 s and 60-180 s overlap: the agent bills their 3-minute union.
    expect(agentLine).to.include({
      kind: 'agent',
      agentId: s.agent.id,
      name: 'My Codex',
      basis: 'active',
      minutes: 3,
      assistedMinutes: 1.5,
      waitMinutes: 0,
      unclassifiedMinutes: 3,
      rateHourCents: 600,
      amountCents: 30,
    })
    // Attaching at $6 came after the runs started: all 3 minutes predate it.
    expect(agentLine.rateChanges).to.have.length(1)
    expect(agentLine.rateChanges[0]).to.include({
      fromCents: 0,
      toCents: 600,
      minutesBefore: 3,
    })
    expect(invoice.amountCents).to.equal(humanLine.amountCents + 30)
    const linked = async () =>
      (await App.conn.manager.find(TimeAgent))
        .filter((run) => run.invoiceId === invoice.id)
        .map((run) => run.sourceRunId)
        .sort()
    expect(await linked()).to.deep.equal(['a', 'b'])
    expect(
      (await this.client(s.owner).get(`/invoice/${invoice.id}`)).data.lines,
    ).to.have.length(2)

    expect(
      (await this.client(s.owner).post(`/invoice/${invoice.id}/reject`, {}))
        .status,
    ).to.equal(200)
    expect(await linked()).to.deep.equal([])
  }
  @test() async periodInvoicesBillOnlyRunsStartingInThePeriod() {
    const s = await this.scenario('fixed')
    await s.uploader.post('/agent-tracking/events', {
      events: [
        s.event('run.started', 0, 0, { runId: 'a' }),
        s.event('run.completed', 1, 120000, { runId: 'a' }),
        s.event('run.started', 2, 60000, { runId: 'b' }),
        s.event('run.completed', 3, 180000, { runId: 'b' }),
      ],
    })
    const first = await App.conn.manager.findOneByOrFail(TimeAgent, {
      sourceRunId: 'a',
    })
    // No human time at all: the invoice carries the agent line alone.
    const invoice = await s.client.post(`/invoice/project/${s.project.id}`, {
      fromUnix: +first.fromAt,
      toUnix: +first.fromAt + 30000,
    })
    expect(invoice.status).to.equal(200)
    expect(invoice.data.lines).to.have.length(1)
    expect(invoice.data.lines[0]).to.include({ kind: 'agent', minutes: 2 })
    expect(invoice.data.amountCents).to.equal(20)
  }
}
