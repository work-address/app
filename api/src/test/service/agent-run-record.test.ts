import { suite, test } from '@testdeck/mocha'
import { FREE_RETENTION_DAYS } from '@/model/plan'
import { expect } from 'chai'
import { randomUUID } from 'crypto'
import moment from 'moment'
import { IsNull, Not } from 'typeorm'

import { AgentCredential } from '@/entity/agent-credential'
import { AgentEvent } from '@/entity/agent-event'
import { Project } from '@/entity/project'
import { TimeAgent } from '@/entity/time-agent'
import { User } from '@/entity/user'
import { EInvoiceState } from '@/model/invoice'
import { AgentRepository } from '@/repository/agent-repository'
import { AgentRunRecord } from '@/service/agent-run-record'
import { runPromise } from '@/service/effect-bridge'
import { InvoiceManager } from '@/service/invoice-manager'
import { StatisticsManager } from '@/service/statistics-manager'
import { TimeManager } from '@/service/time-manager'
import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { InvoiceFixture } from '@/test/fixture/invoice-fixture'
import { ProjectFixture } from '@/test/fixture/project-fixture'

type Mode = 'timer' | 'fixed'
type Results = { eventId: string; status: string; code?: string }[]

const statusOf = (r: { status: string }) => r.status

/**
 * A run's whole life at the module's interface, on real Postgres: advisory
 * locks and JSONB leave nothing worth faking. Envelope, auth and status codes
 * stay in test/controller/agent-controller.test.ts.
 */
@suite()
export class AgentRunRecordTest extends AbstractDatabaseIntegration {
  private record: AgentRunRecord
  private agents: AgentRepository
  private invoices: InvoiceManager
  private projects: ProjectFixture
  private previousFlag: string | undefined
  private savedSecret: string

  constructor() {
    super()
    this.record = this.container.get('AgentRunRecord')
    this.agents = this.container.get('AgentRepository')
    this.invoices = this.container.get('InvoiceManager')
    this.projects = this.container.get('ProjectFixture')
  }

  async before() {
    this.previousFlag = process.env.AGENT_TRACKING_ENABLED
    delete process.env.AGENT_TRACKING_ENABLED
    this.savedSecret = this.parameters.entitlementSecret
    await super.before()
  }

  async after() {
    if (this.previousFlag === undefined)
      delete process.env.AGENT_TRACKING_ENABLED
    else process.env.AGENT_TRACKING_ENABLED = this.previousFlag
    this.parameters.entitlementSecret = this.savedSecret
    await super.after()
  }

  private uploader(credential: string) {
    return async (events: unknown[], health?: unknown): Promise<Results> =>
      (
        await this.record.ingest(`Bearer ${credential}`, {
          events,
          ...(health ? { health } : {}),
        })
      ).results as Results
  }

  private async refusal(act: () => Promise<unknown>): Promise<unknown> {
    try {
      await act()
    } catch (error) {
      return (error as { httpCode?: number }).httpCode ?? error
    }
    return undefined
  }

  private async project(owner: User, fields: Partial<Project> = {}) {
    const project = await this.projects.createPersonal(owner, 60)
    project.trackAgents = true
    Object.assign(project, fields)
    return this.conn.manager.save(project)
  }

  /** Builds events for one machine, for one run unless told otherwise. */
  private events(projectId: string, instanceId: string) {
    const epoch = randomUUID()
    const start = Date.now() - 300000
    return (
      eventType: string,
      sequence: number,
      offset: number,
      extra: Record<string, unknown> = {},
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
      projectId,
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
  }

  /** A worker with an attached agent and a credential for one machine. */
  private async scenario(mode: Mode = 'timer') {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.project(owner, {
      workerAddresses: [worker.address],
      viewerAddresses: [viewer.address],
    })
    const agent = await this.agents.save(
      worker,
      {
        name: 'My Codex',
        slug: 'my-codex',
        product: 'codex',
        isDefault: true,
        bindings: [],
      },
      true,
    )
    await this.agents.attach(worker, project.id, agent.id!, 600)
    const instanceId = randomUUID()
    const issued = await this.agents.issue(worker, { instanceId, mode })
    return {
      owner,
      worker,
      viewer,
      project,
      agent,
      issued,
      upload: this.uploader(issued.credential),
      event: this.events(project.id, instanceId),
    }
  }

  /** A worker on an opted-in project who never set up an agent. */
  private async unprovisioned(mode: Mode = 'timer', trackAgents = true) {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.project(owner, {
      workerAddresses: [worker.address],
      trackAgents,
    })
    const instanceId = randomUUID()
    const issued = await this.agents.issue(worker, { instanceId, mode })
    const uploadEvents = this.uploader(issued.credential)
    let sequence = 0
    const build = this.events(project.id, instanceId)
    const started = (extra = {}) => {
      const at = new Date(Date.now() - 60000).toISOString()
      return build('run.started', sequence++, 0, {
        runId: randomUUID(),
        occurredAt: at,
        observedAt: at,
        ...extra,
      })
    }
    const upload = async (extra = {}) =>
      (await uploadEvents([started(extra)]))[0]
    const state = async () => ({
      agents: (await this.conn.manager.findOneByOrFail(User, { id: worker.id }))
        .agents,
      attachments: (
        await this.conn.manager.findOneByOrFail(Project, { id: project.id })
      ).agentAttachments,
    })
    return {
      owner,
      worker,
      project,
      issued,
      instanceId,
      upload,
      uploadEvents,
      started,
      state,
    }
  }

  /** Backdate receipt so the runs are past the grace and staleness windows. */
  private async settle(runIds: string[]) {
    await this.conn.manager.query(
      `UPDATE time_agent SET "updatedAt" = NOW() - INTERVAL '2 minutes' WHERE "sourceRunId" = ANY($1)`,
      [runIds],
    )
  }

  private run(sourceRunId: string) {
    return this.conn.manager.findOneByOrFail(TimeAgent, { sourceRunId })
  }

  // Provisioning

  @test() async firstLaptopRunGetsADefaultAgentAttachedToTheProject() {
    const s = await this.unprovisioned()
    expect((await s.upload()).status).to.equal('accepted')
    const { agents, attachments } = await s.state()
    expect(agents).to.have.length(1)
    expect(agents[0]).to.include({
      name: 'Codex',
      slug: 'codex',
      product: 'codex',
      isDefault: true,
      removedAt: null,
    })
    expect(attachments).to.have.length(1)
    expect(attachments[0]).to.include({
      agentId: agents[0].id,
      workerId: s.worker.id,
      rateHourCents: 0,
      detachedAt: null,
    })
    // a later run reuses them
    expect((await s.upload()).status).to.equal('accepted')
    const again = await s.state()
    expect(again.agents).to.have.length(1)
    expect(again.attachments).to.have.length(1)
  }

  @test() async provisioningLeavesTheWorkersOwnChoicesAlone() {
    // detached on purpose: not attached again
    const detached = await this.unprovisioned()
    await detached.upload()
    const agent = (await detached.state()).agents[0]
    await this.agents.attach(
      detached.worker,
      detached.project.id,
      agent.id,
      null,
    )
    expect((await detached.upload()).code).to.equal('AGENT_NOT_ATTACHED')
    expect((await detached.state()).attachments[0].detachedAt).not.to.equal(
      null,
    )
    // removed on purpose: not created again
    const removed = await this.unprovisioned()
    await removed.upload()
    const own = (await removed.state()).agents[0]
    await this.agents.remove(removed.worker, own.id)
    expect((await removed.upload()).code).to.equal('AGENT_NOT_ATTACHED')
    expect(
      (await removed.state()).agents.filter((a) => !a.removedAt),
    ).to.have.length(0)
    // a project that did not opt in gets nothing attached
    const off = await this.unprovisioned('timer', false)
    expect((await off.upload()).code).to.equal('AGENT_TRACKING_OFF')
    expect((await off.state()).attachments ?? []).to.have.length(0)
    // server collectors name their agent: nothing is created for them
    const fixed = await this.unprovisioned('fixed')
    expect((await fixed.upload()).status).to.equal('rejected')
    expect((await fixed.state()).agents ?? []).to.have.length(0)
  }

  /** The checks run first: nothing a refused batch brought is kept. */
  @test() async aRefusedBatchProvisionsNothing() {
    const nothing = async (
      s: Awaited<ReturnType<typeof this.unprovisioned>>,
    ) => {
      const { agents, attachments } = await s.state()
      expect(agents ?? []).to.have.length(0)
      expect(attachments ?? []).to.have.length(0)
      expect(await this.conn.manager.count(AgentEvent)).to.equal(0)
    }

    const limited = await this.unprovisioned()
    await this.conn.manager.update(AgentCredential, limited.issued.id, {
      tokens: 0,
      refillAt: new Date(),
    })
    expect(await this.refusal(() => limited.upload())).to.equal(429)
    await nothing(limited)
    // Nothing charged for it either.
    expect(
      (
        await this.conn.manager.findOneByOrFail(AgentCredential, {
          id: limited.issued.id,
        })
      ).tokens,
    ).to.equal(0)

    const outOfScope = await this.unprovisioned()
    expect(
      await this.refusal(() =>
        outOfScope.uploadEvents([
          {
            ...outOfScope.started(),
            source: {
              ...outOfScope.started().source,
              instanceId: randomUUID(),
            },
          },
        ]),
      ),
    ).to.equal(403)
    await nothing(outOfScope)

    const revoked = await this.unprovisioned()
    await this.agents.revoke(revoked.worker, revoked.issued.id)
    expect(await this.refusal(() => revoked.upload())).to.equal(401)
    await nothing(revoked)

    const expired = await this.unprovisioned()
    await this.conn.manager.update(AgentCredential, expired.issued.id, {
      expiresAt: new Date(Date.now() - 1000),
    })
    expect(await this.refusal(() => expired.upload())).to.equal(401)
    await nothing(expired)
  }

  /** Not a refused batch, but each of its events is: the result is the same. */
  @test() async eventsRefusedWhoeverSentThemProvisionNothing() {
    const future = new Date(Date.now() + 3600_000).toISOString()
    const ahead = await this.unprovisioned()
    expect(
      (await ahead.upload({ occurredAt: future, observedAt: future })).code,
    ).to.equal('FUTURE_TIMESTAMP')
    expect((await ahead.state()).agents ?? []).to.have.length(0)

    const stale = new Date(Date.now() - 8 * 86400000).toISOString()
    const behind = await this.unprovisioned()
    expect(
      (await behind.upload({ occurredAt: stale, observedAt: stale })).code,
    ).to.equal('REVISION_WINDOW_EXPIRED')
    expect((await behind.state()).agents ?? []).to.have.length(0)

    const elsewhere = await this.unprovisioned()
    expect((await elsewhere.upload({ projectId: randomUUID() })).code).to.equal(
      'PROJECT_UNAVAILABLE',
    )
    expect((await elsewhere.state()).agents ?? []).to.have.length(0)
  }

  @test() async aMachineBoundAgentIsChosenOverTheDefaultInAnySpelling() {
    const s = await this.unprovisioned()
    const preferred = await this.agents.save(
      s.worker,
      {
        name: 'Laptop',
        slug: 'laptop',
        product: 'codex',
        isDefault: false,
        bindings: [],
      },
      true,
    )
    await this.agents.save(
      s.worker,
      {
        name: 'Default',
        slug: 'default',
        product: 'codex',
        isDefault: true,
        bindings: [],
      },
      true,
    )
    // Old JSON bindings may still have their original spelling.
    const stored = await this.conn.manager.findOneByOrFail(User, {
      id: s.worker.id,
    })
    stored.agents.find((a) => a.id === preferred.id)!.bindings = [
      s.instanceId.toUpperCase(),
    ]
    await this.conn.manager.update(User, stored.id, { agents: stored.agents })

    expect((await s.upload()).status).to.equal('accepted')
    expect((await s.state()).attachments[0].agentId).to.equal(preferred.id)
    expect((await this.conn.manager.find(TimeAgent))[0].agentId).to.equal(
      preferred.id,
    )
  }

  // Rejection order

  @test() async aBatchIsRefusedForTheFirstReasonInOrder() {
    const s = await this.scenario()
    const outOfScope = {
      ...s.event('run.started', 0, 0),
      source: {
        ...s.event('run.started', 0, 0).source,
        instanceId: randomUUID(),
      },
    }
    await this.conn.manager.update(AgentCredential, s.issued.id, {
      tokens: 0,
      refillAt: new Date(),
    })
    // Rate limited and out of scope: the rate limit speaks.
    expect(await this.refusal(() => s.upload([outOfScope]))).to.equal(429)
    await this.conn.manager.update(AgentCredential, s.issued.id, {
      tokens: 600,
    })
    // Out of scope with an unavailable project in the batch: the batch is refused.
    expect(
      await this.refusal(() =>
        s.upload([
          outOfScope,
          s.event('run.started', 1, 0, { projectId: randomUUID() }),
        ]),
      ),
    ).to.equal(403)
    // Revoked and rate limited: not knowing who it is comes first.
    await this.conn.manager.update(AgentCredential, s.issued.id, {
      tokens: 0,
      revokedAt: new Date(),
    })
    expect(await this.refusal(() => s.upload([outOfScope]))).to.equal(401)
  }

  @test() async anEventIsRejectedForTheFirstReasonInOrder() {
    const s = await this.scenario('fixed')
    const source = (extra = {}) => ({
      ...s.event('run.started', 0, 0).source,
      agent: s.agent.slug,
      ...extra,
    })
    const at = (ms: number) => new Date(Date.now() + ms).toISOString()
    const one = async (event: unknown) => (await s.upload([event]))[0].code

    const closed = await this.project(s.owner, {
      workerAddresses: [s.worker.address],
      state: 'Inactive' as never,
    })
    // Off beats a window that has also passed, and the unattached agent.
    expect(
      await one(
        s.event('run.started', 0, 0, {
          projectId: closed.id,
          occurredAt: at(-8 * 86400000),
          observedAt: at(-8 * 86400000),
          source: source(),
        }),
      ),
    ).to.equal('AGENT_TRACKING_OFF')
    // The expired window beats a future observation.
    expect(
      await one(
        s.event('run.started', 0, 0, {
          runId: 'old-and-future',
          occurredAt: at(-8 * 86400000),
          observedAt: at(3600_000),
          source: source(),
        }),
      ),
    ).to.equal('REVISION_WINDOW_EXPIRED')

    expect(
      await one(
        s.event('run.started', 0, 0, {
          runId: 'scoped',
          source: source(),
        }),
      ),
    ).to.equal(undefined)
    const other = await this.project(s.owner, {
      workerAddresses: [s.worker.address],
    })
    // The same run on another project, where the agent is not attached either.
    expect(
      await one(
        s.event('run.completed', 1, 1000, {
          runId: 'scoped',
          projectId: other.id,
          source: source(),
        }),
      ),
    ).to.equal('RUN_SCOPE_MISMATCH')
    // A future timestamp beats that mismatch.
    expect(
      await one(
        s.event('run.completed', 1, 1000, {
          runId: 'scoped',
          projectId: other.id,
          occurredAt: at(3600_000),
          observedAt: at(3600_000),
          source: source(),
        }),
      ),
    ).to.equal('FUTURE_TIMESTAMP')
    expect(
      await one(
        s.event('run.started', 0, 0, {
          runId: 'unattached',
          projectId: other.id,
          source: source(),
        }),
      ),
    ).to.equal('AGENT_NOT_ATTACHED')

    // What was already stored answers before the project's state does.
    const stored = s.event('run.started', 0, 0, {
      runId: 'stored',
      source: source(),
    })
    expect((await s.upload([stored]))[0].status).to.equal('accepted')
    await this.conn.manager.update(Project, s.project.id, {
      trackAgents: false,
    })
    expect((await s.upload([stored]))[0].status).to.equal('duplicate')
    expect(await one({ ...stored, runId: 'different' })).to.equal(
      'EVENT_ID_CONFLICT',
    )
    expect(
      await one(
        s.event('run.started', 0, 0, {
          projectId: randomUUID(),
          source: source(),
        }),
      ),
    ).to.equal('PROJECT_UNAVAILABLE')
  }

  // Events into a run

  @test() async lifecycleReplayPausesAndVisibilityAreScoped() {
    const s = await this.scenario()
    const events = [
      s.event('run.started', 0, 0, { prompt: 'Fix the login bug' }),
      s.event('tracking.paused', 1, 60000, { reason: 'idle' }),
      s.event('tracking.resumed', 2, 120000, { reason: 'started' }),
      s.event('run.completed', 3, 180000),
    ]
    expect((await s.upload(events)).map(statusOf)).to.deep.equal(
      events.map(() => 'accepted'),
    )
    expect(
      (await s.upload([...events].reverse())).every(
        (r) => r.status === 'duplicate',
      ),
    ).to.equal(true)
    const [runs, count] = await this.record.search(s.worker, {
      projectId: s.project.id,
    })
    expect(count).to.equal(1)
    expect(runs[0].segments.map((v) => v.state)).to.deep.equal([
      'unknown',
      'untracked',
      'unknown',
    ])
    expect(runs[0].measurement.qualification).to.equal('unqualified')
    expect(runs[0].prompt).to.equal('Fix the login bug')
    const [owned, ownedCount] = await this.record.search(s.owner, {
      projectId: s.project.id,
    })
    expect(ownedCount).to.equal(1)
    // Another worker's prompt is detail: held from the owner until the
    // worker's review window passes.
    expect(owned[0].prompt).to.equal(null)
    expect(owned[0].promptPendingReview).to.equal(true)
    const dayAgo = Date.now() - 25 * 3600_000
    await this.conn.manager.update(
      TimeAgent,
      { runKey: owned[0].runKey },
      { fromAt: new Date(dayAgo - 180000), toAt: new Date(dayAgo) },
    )
    // Without a project the search covers every project the owner works on.
    const [released, releasedCount] = await this.record.search(s.owner, {})
    expect(releasedCount).to.equal(1)
    expect(released[0].prompt).to.equal('Fix the login bug')
    expect(released[0].promptPendingReview).to.equal(undefined)
    expect(
      await this.refusal(() =>
        this.record.search(s.viewer, { projectId: s.project.id }),
      ),
    ).to.equal(403)
    expect(
      (await s.upload([{ ...events[0], runId: 'different' }]))[0].code,
    ).to.equal('EVENT_ID_CONFLICT')
  }

  @test() async terminalBeforeStartIsDurableAndReconcilesAfterRetry() {
    const s = await this.scenario()
    const end = s.event('run.completed', 1, 60000)
    await s.upload([end])
    expect(await this.conn.manager.count(TimeAgent)).to.equal(0)
    expect(
      (
        await this.conn.manager.findOneByOrFail(AgentEvent, {
          eventId: end.eventId,
        })
      ).code,
    ).to.equal('MISSING_START')
    await s.upload([s.event('run.started', 0, 0)])
    expect(await this.conn.manager.count(TimeAgent)).to.equal(1)
    expect(
      (
        await this.conn.manager.findOneByOrFail(AgentEvent, {
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
          await s.upload(events.slice(0, 2))
          expect((await this.run(runId)).status).to.equal('completed')
        }
        await s.upload(incremental ? events.slice(2) : events)
        expect(
          await this.conn.manager.count(TimeAgent, {
            where: { sourceRunId: runId },
          }),
        ).to.equal(0)
        for (const stored of events) {
          expect(
            await this.conn.manager.findOneByOrFail(AgentEvent, {
              eventId: stored.eventId,
            }),
          ).to.include({ status: 'quarantined', code })
        }
        expect(
          (await s.upload([...events].reverse())).every(
            (r) => r.status === 'duplicate',
          ),
        ).to.equal(true)
      }
    }
    expect(
      (await this.record.search(s.worker, { projectId: s.project.id }))[1],
    ).to.equal(0)
    const { diagnostics } = await this.record.status(s.worker)
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
      product: 'codex' as const,
      isDefault: false,
      bindings: [binding],
    }
    const created = await this.agents.save(s.worker, payload, true)
    expect(created.bindings).to.deep.equal([s.issued.instanceId])
    const id = created.id!
    await this.agents.save(
      s.worker,
      { ...payload, id: id.toUpperCase() },
      false,
    )
    expect(
      await this.refusal(() =>
        this.agents.save(
          s.worker,
          { ...payload, slug: 'duplicate', bindings: [binding.toLowerCase()] },
          true,
        ),
      ),
    ).to.equal(400)
    expect(
      await this.refusal(() =>
        this.agents.save(
          s.worker,
          { ...payload, id, bindings: [binding, binding.toLowerCase()] },
          false,
        ),
      ),
    ).to.equal(400)
    await this.agents.attach(
      s.worker,
      s.project.id.toUpperCase(),
      id.toUpperCase(),
      600,
    )
    // Old JSON bindings may still have their original spelling.
    const stored = await this.conn.manager.findOneByOrFail(User, {
      id: s.worker.id,
    })
    stored.agents.find((agent) => agent.id === id)!.bindings = [binding]
    await this.conn.manager.update(User, stored.id, { agents: stored.agents })
    expect(
      await this.refusal(() =>
        this.agents.save(
          s.worker,
          {
            ...payload,
            slug: 'duplicate-legacy',
            bindings: [binding.toLowerCase()],
          },
          true,
        ),
      ),
    ).to.equal(400)
    const credential = await this.agents.issue(s.worker, {
      instanceId: binding,
      mode: 'fixed',
    })
    expect(credential.instanceId).to.equal(binding.toLowerCase())
    const upload = this.uploader(credential.credential)
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
    const concurrent = await Promise.all([upload([start]), s.upload([retry])])
    expect(concurrent.map((r) => r[0].status).sort()).to.deep.equal([
      'accepted',
      'duplicate',
    ])
    expect(concurrent.map((r) => r[0].eventId)).to.deep.equal([
      start.eventId,
      retry.eventId,
    ])
    expect(await upload([retry])).to.deep.equal([
      { eventId: retry.eventId, status: 'duplicate' },
    ])
    await upload([
      s.event('run.completed', 1, 60000, { runId: 'MixedCaseRun' }),
    ])
    const [runs, count] = await this.record.search(s.worker, {
      projectId: s.project.id.toUpperCase(),
    })
    expect(count).to.equal(1)
    expect(runs[0]).to.include({
      agentId: id,
      status: 'completed',
      sourceInstanceId: binding.toLowerCase(),
      sourceRunId: 'MixedCaseRun',
    })
    expect(await this.conn.manager.count(AgentEvent)).to.equal(2)
    await this.agents.remove(s.worker, id.toUpperCase())
  }

  @test() async lateEventsReplayWithPreviouslyStoredUppercaseEpochs() {
    const s = await this.scenario('fixed')
    const start = s.event('run.started', 0, 0)
    const end = s.event('run.completed', 2, 60000)
    await s.upload([start, end])
    const before = await this.run(start.runId)
    expect(before.status).to.equal('completed')

    // Recreate the JSON spelling persisted before UUID normalization existed.
    const stored = await this.conn.manager.findBy(AgentEvent, {
      runKey: before.runKey,
    })
    for (const record of stored) {
      record.payload.source.epoch = record.payload.source.epoch.toUpperCase()
      await this.conn.manager.update(AgentEvent, record.id, {
        payload: record.payload,
      })
    }
    const late = s.event('run.observed', 1, 30000, {
      observedState: 'unknown',
      evidenceKind: 'runtime_state',
    })
    for (const status of ['accepted', 'duplicate']) {
      expect(await s.upload([late])).to.deep.equal([
        { eventId: late.eventId, status },
      ])
      const runs = await this.conn.manager.find(TimeAgent)
      expect(runs).to.have.length(1)
      expect(runs[0]).to.include({ id: before.id, status: 'completed' })
      expect(runs[0].fromAt).to.deep.equal(before.fromAt)
      expect(runs[0].toAt).to.deep.equal(before.toAt)
      expect(runs[0].segments).to.deep.equal(before.segments)
    }
    const records = await this.conn.manager.find(AgentEvent)
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

  @test() async policiesMembershipAndDetachAreCheckedOnEveryUpload() {
    const s = await this.scenario()
    await this.agents.attach(s.worker, s.project.id, s.agent.id!, null)
    expect((await s.upload([s.event('run.started', 0, 0)]))[0].code).to.equal(
      'AGENT_NOT_ATTACHED',
    )
    await this.agents.attach(s.worker, s.project.id, s.agent.id!, 900)
    const attachments = await this.agents.attachments(s.worker, s.project.id)
    expect(attachments[0].rateChanges).to.have.length(2)
    await this.conn.manager.update(Project, s.project.id, {
      trackAgents: false,
    })
    expect((await s.upload([s.event('run.started', 0, 0)]))[0].code).to.equal(
      'AGENT_TRACKING_OFF',
    )
    await this.conn.manager.update(Project, s.project.id, {
      trackAgents: true,
      workerAddresses: [],
    })
    expect((await s.upload([s.event('run.started', 0, 0)]))[0].code).to.equal(
      'PROJECT_UNAVAILABLE',
    )
  }

  @test() async unavailableProjectsRejectOnlyTheirOwnEvents() {
    const s = await this.scenario()
    const kept = s.event('run.started', 0, 0)
    const gone = s.event('run.started', 1, 1000, {
      projectId: randomUUID(),
      runId: 'other-run',
    })
    expect(await s.upload([gone, kept])).to.deep.equal([
      {
        eventId: gone.eventId,
        status: 'rejected',
        code: 'PROJECT_UNAVAILABLE',
      },
      { eventId: kept.eventId, status: 'accepted' },
    ])
    expect(await this.conn.manager.count(AgentEvent)).to.equal(1)
    // A deleted project rejects its later events, still one by one.
    await this.conn.getRepository(Project).softDelete(s.project.id)
    const after = s.event('run.completed', 2, 2000)
    expect(await s.upload([after])).to.deep.equal([
      {
        eventId: after.eventId,
        status: 'rejected',
        code: 'PROJECT_UNAVAILABLE',
      },
    ])
    expect(await this.conn.manager.count(AgentEvent)).to.equal(1)
  }

  // Frozen once billed, released

  @test() async invoiceFreezeQuarantinesLateEventsUntilOwnerRejects() {
    const s = await this.scenario()
    await s.upload([s.event('run.started', 0, 0)])
    const run = (await this.conn.manager.find(TimeAgent))[0]
    const invoice = await this.container
      .get<InvoiceFixture>('InvoiceFixture')
      .create(s.project, 0, EInvoiceState.REQUESTED)
    await this.conn.manager.update(TimeAgent, run.id, {
      invoiceId: invoice.id,
    })
    const late = s.event('run.completed', 1, 60000)
    expect((await s.upload([late]))[0].code).to.equal('RUN_INVOICED')
    expect(
      +(await this.conn.manager.findOneByOrFail(TimeAgent, { id: run.id }))
        .toAt,
    ).to.equal(+run.toAt)
    await runPromise(this.invoices.reject(invoice, s.owner))
    const corrected = await this.conn.manager.findOneByOrFail(TimeAgent, {
      id: run.id,
    })
    expect(corrected.invoiceId).to.equal(null)
    expect(corrected.status).to.equal('completed')
    expect(+corrected.toAt - +corrected.fromAt).to.equal(60000)
  }

  // Removing a prompt

  private async promptedRun(s: Awaited<ReturnType<typeof this.scenario>>) {
    const start = s.event('run.started', 0, 0, { prompt: 'Fix the login bug' })
    await s.upload([start])
    const [[run]] = await this.record.search(s.worker, {
      projectId: s.project.id,
    })
    return { start, run }
  }

  private async storedPrompts() {
    return (await this.conn.manager.find(AgentEvent)).filter(
      (event) => 'prompt' in event.payload,
    )
  }

  @test() async removingAPromptErasesItAndLeavesTheRunsTime() {
    const s = await this.scenario()
    const { run } = await this.promptedRun(s)
    await s.upload([s.event('run.completed', 1, 60000)])
    const before = await this.conn.manager.findOneByOrFail(TimeAgent, {
      id: run.id,
    })

    await this.record.removePrompt(s.worker, run.runKey)

    const after = await this.conn.manager.findOneByOrFail(TimeAgent, {
      id: run.id,
    })
    expect(after.prompt).to.equal(null)
    expect(after.segments).to.deep.equal(before.segments)
    expect(+after.toAt).to.equal(+before.toAt)
    expect(await this.storedPrompts()).to.deep.equal([])

    // No trace for the author, or for an owner it was still held from.
    const [[own]] = await this.record.search(s.worker, {
      projectId: s.project.id,
    })
    const [[owned]] = await this.record.search(s.owner, {
      projectId: s.project.id,
    })
    expect(own.prompt).to.equal(null)
    expect(own).to.not.have.property('promptRemovedAt')
    expect(owned.prompt).to.equal(null)
    expect(owned.promptPendingReview).to.equal(undefined)
    expect(owned).to.not.have.property('promptRemovedAt')

    // Removing it again changes nothing.
    await this.record.removePrompt(s.worker, run.runKey)
  }

  @test() async aRemovedPromptDoesNotComeBack() {
    const s = await this.scenario()
    const { start, run } = await this.promptedRun(s)
    await this.record.removePrompt(s.worker, run.runKey)
    const promptOf = async () =>
      (await this.conn.manager.findOneByOrFail(TimeAgent, { id: run.id }))
        .prompt

    // A collector retrying the event it already sent.
    expect((await s.upload([start]))[0].status).to.equal('duplicate')
    // A second start for the same moment, carrying the text again.
    const again = s.event('run.started', 1, 0, { prompt: 'Fix the login bug' })
    expect((await s.upload([again]))[0].status).to.equal('accepted')
    expect(await promptOf()).to.equal(null)
    // A late event makes the run rebuild itself from its events.
    await s.upload([s.event('run.completed', 2, 60000)])
    expect(await promptOf()).to.equal(null)
    expect(await this.storedPrompts()).to.deep.equal([])
  }

  @test() async onlyItsAuthorCanRemoveAPromptWhileItIsUnbilled() {
    const s = await this.scenario()
    const { run } = await this.promptedRun(s)
    const remove = (user: User, runKey = run.runKey) =>
      this.refusal(() => this.record.removePrompt(user, runKey))

    expect(await remove(s.owner)).to.equal(403)
    expect(await remove(s.viewer)).to.equal(403)
    expect(await remove(s.worker, 'f'.repeat(64))).to.equal(404)
    expect(
      (await this.conn.manager.findOneByOrFail(TimeAgent, { id: run.id }))
        .prompt,
    ).to.equal('Fix the login bug')

    const invoice = await this.container
      .get<InvoiceFixture>('InvoiceFixture')
      .create(s.project, 0, EInvoiceState.REQUESTED)
    await this.conn.manager.update(TimeAgent, run.id, {
      invoiceId: invoice.id,
    })
    expect(await remove(s.worker)).to.equal(409)
    expect((await this.storedPrompts()).length).to.equal(1)

    // A rejected invoice hands the run back, prompt included, to remove again.
    await runPromise(this.invoices.reject(invoice, s.owner))
    expect(await remove(s.worker)).to.equal(undefined)
    expect(await this.storedPrompts()).to.deep.equal([])
  }

  @test() async aRemovedPromptStaysGoneThroughARejectedInvoice() {
    const s = await this.scenario()
    const { run } = await this.promptedRun(s)
    await this.record.removePrompt(s.worker, run.runKey)
    const invoice = await this.container
      .get<InvoiceFixture>('InvoiceFixture')
      .create(s.project, 0, EInvoiceState.REQUESTED)
    await this.conn.manager.update(TimeAgent, run.id, {
      invoiceId: invoice.id,
    })

    await runPromise(this.invoices.reject(invoice, s.owner))

    const released = await this.conn.manager.findOneByOrFail(TimeAgent, {
      id: run.id,
    })
    expect(released.invoiceId).to.equal(null)
    expect(released.prompt).to.equal(null)
  }

  private async bothRuns(s: Awaited<ReturnType<typeof this.scenario>>) {
    await s.upload(
      (
        [
          ['run.started', 0, 0, 'a'],
          ['run.completed', 1, 120000, 'a'],
          ['run.started', 2, 60000, 'b'],
          ['run.completed', 3, 180000, 'b'],
        ] as const
      ).map(([type, sequence, offset, runId]) =>
        s.event(type, sequence, offset, { runId }),
      ),
    )
  }

  @test() async finishedRunsBillTheirUnionOnTheAgentsOwnLine() {
    const s = await this.scenario('fixed')
    await this.bothRuns(s)
    // Still running: not finished, so it waits for a later invoice.
    await s.upload([s.event('run.started', 4, 295000, { runId: 'open' })])
    await this.settle(['a', 'b'])
    const first = await this.run('a')
    // The worker's own entry overlaps the first 90 s: that part is assisted.
    const [human] = await runPromise(
      this.container.get<TimeManager>('TimeManager').createOrUpdateMany(
        [
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
          } as never,
        ],
        s.worker,
      ),
    )
    expect(human.error).to.equal(undefined)

    const invoice = (await runPromise(
      this.invoices.ensureForProject(s.project, s.worker),
    ))!
    const [humanLine, agentLine] = invoice.lines!
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
    expect(agentLine.rateChanges![0]).to.include({
      fromCents: 0,
      toCents: 600,
      minutesBefore: 3,
    })
    expect(invoice.amountCents).to.equal(humanLine.amountCents + 30)
    const linked = async () =>
      (await this.conn.manager.find(TimeAgent))
        .filter((run) => run.invoiceId === invoice.id)
        .map((run) => run.sourceRunId)
        .sort()
    expect(await linked()).to.deep.equal(['a', 'b'])

    await runPromise(this.invoices.reject(invoice, s.owner))
    expect(await linked()).to.deep.equal([])
  }

  /** Invoicing asks; the record writes. */
  @test() async aBilledRunFollowsItsInvoicesPayment() {
    const s = await this.scenario('fixed')
    await this.bothRuns(s)
    await this.settle(['a', 'b'])
    expect(await this.record.hasBillable(s.project.id, s.worker.id)).to.equal(
      true,
    )
    const invoice = (await runPromise(
      this.invoices.ensureForProject(s.project, s.worker),
    ))!
    expect(await this.record.hasBillable(s.project.id, s.worker.id)).to.equal(
      false,
    )

    await runPromise(this.invoices.markPaid(invoice, s.worker))
    expect((await this.run('a')).isPaid).to.equal(true)
    await runPromise(this.invoices.markUnpaid(invoice, s.worker))
    expect((await this.run('a')).isPaid).to.equal(false)
  }

  @test() async periodInvoicesBillOnlyRunsStartingInThePeriod() {
    const s = await this.scenario('fixed')
    await this.bothRuns(s)
    await this.settle(['a', 'b'])
    const first = await this.run('a')
    // No human time at all: the invoice carries the agent line alone.
    const invoice = await runPromise(
      this.invoices.create(
        { fromUnix: +first.fromAt, toUnix: +first.fromAt + 30000 },
        s.project,
        s.worker,
      ),
    )
    expect(invoice.lines).to.have.length(1)
    expect(invoice.lines![0]).to.include({ kind: 'agent', minutes: 2 })
    expect(invoice.amountCents).to.equal(20)
  }

  @test() async finalityFollowsReceiptAndOnlyObservedRunsGoStale() {
    const s = await this.scenario('fixed')
    const live = {
      ...s.event('run.started', 0, 0).capabilities,
      liveness: true,
    }
    await s.upload([
      // A hook adapter saw only the start; its Stop may still come.
      s.event('run.started', 0, 0, { runId: 'sparse' }),
      // A continuously observed run that went quiet.
      s.event('run.started', 1, 0, { runId: 'live', capabilities: live }),
      s.event('run.observed', 2, 30000, {
        runId: 'live',
        capabilities: live,
        observedState: 'running',
        evidenceKind: 'runtime_state',
      }),
      s.event('run.started', 3, 0, { runId: 'done' }),
      s.event('run.completed', 4, 60000, { runId: 'done' }),
    ])
    const period = {
      fromUnix: +(await this.run('done')).fromAt,
      toUnix: +(await this.run('done')).fromAt + 30000,
    }
    const issue = () =>
      runPromise(this.invoices.create(period, s.project, s.worker))
    // Everything was received a moment ago: inside the grace, nothing bills.
    expect(await this.refusal(issue)).to.equal(400)
    await this.settle(['sparse', 'live', 'done'])
    const invoice = await issue()
    expect(invoice.lines![0]).to.include({ kind: 'agent', minutes: 1 })
    expect(
      (await this.conn.manager.find(TimeAgent))
        .filter((r) => r.invoiceId === invoice.id)
        .map((r) => r.sourceRunId)
        .sort(),
    ).to.deep.equal(['done', 'live'])
    // The sparse run's late Stop still reconciles it instead of being quarantined.
    const late = await s.upload([
      s.event('run.completed', 5, 120000, { runId: 'sparse' }),
    ])
    expect(late[0].status).to.equal('accepted')
    expect(await this.run('sparse')).to.include({ status: 'completed' })
  }

  // Rotation

  /** An owner running their own agents, the one person a free plan leaves. */
  private async ownersRuns(premium = false) {
    const owner = premium
      ? await this.userFixture.createPremiumUser()
      : await this.userFixture.createUser()
    const project = await this.project(owner)
    const agent = await this.agents.save(
      owner,
      {
        name: 'Mine',
        slug: 'mine',
        product: 'codex',
        isDefault: true,
        bindings: [],
      },
      true,
    )
    await this.agents.attach(owner, project.id, agent.id!, 600)
    const instanceId = randomUUID()
    const issued = await this.agents.issue(owner, { instanceId, mode: 'timer' })
    const upload = this.uploader(issued.credential)
    const event = this.events(project.id, instanceId)
    const expired = moment
      .utc()
      .subtract(FREE_RETENTION_DAYS + 1, 'days')
      .toDate()
    const start = (...runIds: string[]) =>
      upload(runIds.map((runId) => event('run.started', 0, 0, { runId })))
    /** Moves runs to before the window, as if they started back then. */
    const expire = async (...runIds: string[]) => {
      for (const sourceRunId of runIds)
        await this.conn.manager.update(
          TimeAgent,
          { sourceRunId },
          { fromAt: expired },
        )
    }
    const live = async () =>
      (await this.conn.manager.find(TimeAgent))
        .map((run) => run.sourceRunId)
        .sort()
    return { owner, project, agent, upload, event, start, expire, live }
  }

  @test() async newEventsRotateAFreeProjectsRunsPastTheWindow() {
    const s = await this.ownersRuns()
    await s.start('old', 'recent')
    await s.expire('old')
    await this.conn.manager.update(
      TimeAgent,
      { sourceRunId: 'recent' },
      {
        fromAt: moment
          .utc()
          .subtract(FREE_RETENTION_DAYS - 1, 'days')
          .toDate(),
      },
    )
    await s.start('new')

    expect(await s.live()).to.deep.equal(['new', 'recent'])
    // Soft, like human time: the row is kept and stays reversible.
    const rotated = await this.conn.manager.findOneOrFail(TimeAgent, {
      where: { sourceRunId: 'old', deletedAt: Not(IsNull()) },
      withDeleted: true,
    })
    expect(rotated.deletedAt).to.be.instanceOf(Date)
    // Gone from what reads runs, and from what bills them.
    expect((await this.record.search(s.owner, {}))[1]).to.equal(2)
    await this.conn.manager.query(
      `UPDATE time_agent SET status='completed', "updatedAt" = NOW() - INTERVAL '2 minutes' WHERE "deletedAt" IS NOT NULL`,
    )
    expect(await this.record.hasBillable(s.project.id, s.owner.id)).to.equal(
      false,
    )
    const daily = await this.container
      .get<StatisticsManager>('StatisticsManager')
      .agentsDaily(
        {
          projectIds: [s.project.id],
          from: moment.utc().subtract(30, 'days').format('YYYY-MM-DD'),
          to: moment.utc().add(1, 'day').format('YYYY-MM-DD'),
          timeZone: 'UTC',
        },
        s.owner,
      )
    expect(daily.runs.reduce((sum, row) => sum + row.count, 0)).to.equal(2)
  }

  /** The event's arrival is the trigger, as for human time; a refused batch changes nothing. */
  @test() async aBatchOfRefusedEventsStillRotatesButARefusedBatchDoesNot() {
    const s = await this.ownersRuns()
    await s.start('old')
    await s.expire('old')
    await this.conn.manager.update(Project, s.project.id, {
      trackAgents: false,
    })
    const refused = await s.upload([
      s.event('run.started', 0, 0, { runId: 'off' }),
    ])
    expect(refused[0].code).to.equal('AGENT_TRACKING_OFF')
    expect(await s.live()).to.deep.equal([])

    const t = await this.ownersRuns()
    await t.start('old')
    await t.expire('old')
    expect(
      await this.refusal(() =>
        t.upload([
          t.event('run.started', 0, 0, {
            runId: 'scope',
            source: {
              ...t.event('run.started', 0, 0).source,
              instanceId: randomUUID(),
            },
          }),
        ]),
      ),
    ).to.equal(403)
    expect(await t.live()).to.deep.equal(['old'])
  }

  @test() async rotationSkipsRunsOnAnInvoiceAndOtherProjects() {
    const s = await this.ownersRuns()
    await s.start('billed', 'released')
    await s.expire('billed', 'released')
    const invoiceFixture = this.container.get<InvoiceFixture>('InvoiceFixture')
    const billed = await invoiceFixture.create(
      s.project,
      0,
      EInvoiceState.REQUESTED,
    )
    await this.conn.manager.update(
      TimeAgent,
      { sourceRunId: 'billed' },
      { invoiceId: billed.id },
    )
    const released = await invoiceFixture.create(
      s.project,
      0,
      EInvoiceState.REQUESTED,
    )
    await this.conn.manager.update(
      TimeAgent,
      { sourceRunId: 'released' },
      { invoiceId: released.id },
    )
    await s.upload([s.event('run.started', 0, 0, { runId: 'a' })])
    expect(await s.live()).to.deep.equal(['a', 'billed', 'released'])

    // A rejected invoice is not evidence: what it released rotates.
    await runPromise(this.invoices.reject(released, s.owner))
    // The release put the run back on its first event's times.
    await s.expire('released')
    await s.upload([s.event('run.started', 0, 0, { runId: 'b' })])
    expect(await s.live()).to.deep.equal(['a', 'b', 'billed'])

    // Another project's new events leave this one's runs alone.
    const other = await this.ownersRuns()
    await other.start('theirs')
    await other.expire('theirs')
    const untouched = await this.project(other.owner)
    await this.agents.attach(other.owner, untouched.id, other.agent.id!, 0)
    await other.upload([
      other.event('run.started', 0, 0, {
        runId: 'elsewhere',
        projectId: untouched.id,
      }),
    ])
    expect(
      (await this.conn.manager.find(TimeAgent))
        .map((run) => run.sourceRunId)
        .sort(),
    ).to.include('theirs')
  }

  /** runKey stays unique across rotated rows: a late event must not collide with one. */
  @test() async aLateEventLeavesARotatedRunRotated() {
    const s = await this.ownersRuns()
    await s.start('old')
    await s.expire('old')
    await s.start('new')
    expect(await s.live()).to.deep.equal(['new'])

    const late = await s.upload([
      s.event('run.completed', 1, 60000, { runId: 'old' }),
    ])

    expect(late[0].status).to.equal('accepted')
    expect(await s.live()).to.deep.equal(['new'])
    expect(
      await this.conn.manager.count(TimeAgent, {
        where: { sourceRunId: 'old' },
        withDeleted: true,
      }),
    ).to.equal(1)
    expect((await this.record.status(s.owner)).diagnostics).to.deep.equal([])
  }
}
