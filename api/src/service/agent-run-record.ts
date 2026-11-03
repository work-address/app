import { createHash, randomUUID, timingSafeEqual } from 'crypto'
import { inject, injectable } from 'inversify'
import {
  BadRequestError,
  ForbiddenError,
  HttpError,
  UnauthorizedError,
} from 'routing-controllers'
import { Brackets, EntityManager, In, SelectQueryBuilder } from 'typeorm'
import {
  MAX_EVENT_BYTES,
  ingestBatchSchema,
} from '@work-address/agent-tracking-contract'
import type {
  AgentEventV1,
  IngestResult,
} from '@work-address/agent-tracking-contract'

import { getDataSource } from '@/connector/data-source'
import { AgentCredential } from '@/entity/agent-credential'
import { AgentEvent } from '@/entity/agent-event'
import { Project } from '@/entity/project'
import { TimeAgent } from '@/entity/time-agent'
import { User } from '@/entity/user'
import { AGENT_PRODUCT_NAMES, WorkerAgent } from '@/model/agent'
import { AgentSearchDto } from '@/model/dto/agent'
import { EProjectState } from '@/model/project'
import { AgentRepository } from '@/repository/agent-repository'
import { AgentIdentity } from '@/service/agent-identity'
import { AgentTimeNormalizer } from '@/service/agent-time-normalizer'
import { Entitlement } from '@/service/entitlement'
import { ProjectAccess } from '@/service/project-access'
import { TimeManager } from '@/service/time-manager'

/** Why an event is refused whoever it belongs to, or null. */
function eventRefusal(
  project: Project,
  event: AgentEventV1,
  firstAt: number,
  now: number,
): string | null {
  if (!project.trackAgents || project.state !== EProjectState.ACTIVE)
    return 'AGENT_TRACKING_OFF'
  if (project.agentTrackingSince && firstAt < +project.agentTrackingSince)
    return 'AGENT_TRACKING_OFF'
  if (Date.parse(event.occurredAt) < now - 7 * 86400000)
    return 'REVISION_WINDOW_EXPIRED'
  if (
    Date.parse(event.occurredAt) > now + 300000 ||
    Date.parse(event.observedAt) > now + 300000
  )
    return 'FUTURE_TIMESTAMP'
  return null
}

/**
 * Why an event for an available project is refused, or null to store it. The
 * order is the contract: the first matching reason is the one reported.
 */
function rejectionCode({
  project,
  event,
  row,
  previous,
  assigned,
  credential,
  user,
  now,
}: {
  project: Project
  event: AgentEventV1
  row: TimeAgent | null
  previous: AgentEvent | null
  assigned: WorkerAgent | undefined
  credential: AgentCredential
  user: User
  now: number
}): string | null {
  const refused = eventRefusal(
    project,
    event,
    row ? +row.fromAt : Date.parse(event.occurredAt),
    now,
  )
  if (refused) return refused
  if (
    previous &&
    (previous.projectId !== event.projectId ||
      previous.mode !== credential.mode ||
      previous.payload.source.agent !== event.source.agent)
  )
    return 'RUN_SCOPE_MISMATCH'
  if (
    !assigned ||
    !project.agentAttachments?.some(
      (a) =>
        a.agentId === assigned.id && a.workerId === user.id && !a.detachedAt,
    )
  )
    return 'AGENT_NOT_ATTACHED'
  return null
}

/** The agent a run goes to when nothing names one: this machine's, or the default. */
function agentForMachine(
  agents: WorkerAgent[],
  product: string,
  instanceId: string,
): WorkerAgent | undefined {
  const live = agents.filter((a) => !a.removedAt && a.product === product)

  return (
    live.find((a) =>
      a.bindings.some((id) => id.toLowerCase() === instanceId.toLowerCase()),
    ) ?? live.find((a) => a.isDefault)
  )
}

/**
 * One agent run's whole life: credentialed events in, the projection they make,
 * frozen once billed, finished, released and rotated. Invoicing asks this what
 * is billable and tells it what was billed; nothing else writes a run's columns
 * or takes its locks. A worker's agents, attachments and credentials are
 * `AgentRepository`. Tests sit on this interface in
 * test/service/agent-run-record.test.ts.
 */
@injectable()
export class AgentRunRecord {
  @inject('AgentRepository') private agents: AgentRepository
  @inject('ProjectAccess') private access: ProjectAccess
  @inject('Entitlement') private entitlement: Entitlement

  /**
   * Stores a credentialed batch and projects the runs it touches. Every check
   * that can refuse the batch runs before anything is written, in one
   * transaction, so a refused batch leaves nothing behind.
   */
  public async ingest(
    authorization: string | undefined,
    body: unknown,
  ): Promise<{ results: IngestResult[] }> {
    // On unless switched off: AGENT_TRACKING_ENABLED=false stops ingestion
    // while credentials, agents and reads keep working. Each project still
    // opts in with trackAgents.
    if (process.env.AGENT_TRACKING_ENABLED === 'false')
      throw new HttpError(503, 'AGENT_TRACKING_DISABLED')
    const parsed = ingestBatchSchema.safeParse(body)
    if (!parsed.success) throw new BadRequestError('INVALID_ENVELOPE')
    if (
      parsed.data.events.some(
        (event) => Buffer.byteLength(JSON.stringify(event)) > MAX_EVENT_BYTES,
      )
    )
      throw new HttpError(413, 'EVENT_TOO_LARGE')
    const secret = (authorization ?? '').replace(/^Bearer /, '')
    if (!/^wa_agent_[0-9a-f]{64}$/.test(secret)) throw new UnauthorizedError()
    // Keep the submitted spelling in acknowledgements for existing collectors.
    const submittedIds = parsed.data.events.map((event) => event.eventId)
    const events = parsed.data.events.map((event) => AgentIdentity.event(event))
    const health = parsed.data.health
    const underRetention: string[] = []

    const results = await getDataSource().transaction(async (tx) => {
      const now = Date.now()
      const credential = await this.validCredential(tx, secret, now)
      if (
        health &&
        credential.lastHealthAt &&
        now - +credential.lastHealthAt < 30000 &&
        !events.length
      )
        throw new HttpError(429, 'HEALTH_RATE_LIMITED')
      const available = Math.min(
        600,
        credential.tokens + (now - +credential.refillAt) / 200,
      )
      if (available < events.length) throw new HttpError(429, 'RATE_LIMITED')
      const user = await this.lockUploader(tx, credential, events)
      // A project that was deleted, or that the uploader no longer works on,
      // rejects only its own events (PROJECT_UNAVAILABLE). Failing the whole
      // batch made a collector's queue for every other project wait behind
      // them. The code does not say whether the project exists.
      const projects = new Map<string, Project | null>()
      for (const projectId of [
        ...new Set(events.map((e) => e.projectId)),
      ].sort()) {
        const project = await this.agents.workerProject(
          tx,
          projectId,
          user,
          await this.attachesTo(tx, projectId, user, credential, events),
        )
        projects.set(projectId, project)
        // The project owner's plan, as human time: see TimeManager.
        if (project && !this.entitlement.isPremium(project.user))
          underRetention.push(project.id)
      }
      if (
        events.some(
          (e) =>
            e.source.instanceId !== credential.instanceId ||
            (credential.mode === 'timer' && e.source.agent) ||
            (credential.mode === 'fixed' &&
              e.eventType.startsWith('tracking.')),
        )
      )
        throw new ForbiddenError('SOURCE_SCOPE_MISMATCH')
      await this.provisionDefaults(tx, credential, user, projects, events, now)
      for (const id of [...new Set(events.map((e) => e.eventId))].sort())
        await this.lock(
          tx,
          `agent-event:${user.id}:${credential.instanceId}:${id}`,
        )
      const results: IngestResult[] = []
      // Stable lock order across concurrent batches and credentials.
      for (const key of [
        ...new Set(events.map((e) => AgentRunRecord.runKey(user.id, e))),
      ].sort())
        await this.lock(tx, `agent:${key}`)
      for (const event of events) {
        results.push(
          await this.store(
            tx,
            event,
            projects.get(event.projectId) ?? null,
            credential,
            user,
            now,
          ),
        )
      }
      for (const runKey of [
        ...new Set(events.map((e) => AgentRunRecord.runKey(user.id, e))),
      ])
        await this.projectRun(tx, runKey, now)
      await tx.update(AgentCredential, credential.id, {
        ...(health ? { health, lastHealthAt: new Date(now) } : {}),
        lastUsedAt: new Date(now),
        tokens: available - events.length,
        refillAt: new Date(now),
      })
      return results
    })

    await this.rotate(underRetention)

    return {
      results: results.map((result, index) => ({
        ...result,
        eventId: submittedIds[index],
      })),
    }
  }

  private async validCredential(
    tx: EntityManager,
    secret: string,
    now: number,
  ): Promise<AgentCredential> {
    const hash = AgentRepository.hash(secret)
    const credential = await tx.findOne(AgentCredential, {
      where: { secretHash: hash },
      lock: { mode: 'pessimistic_write' },
    })
    if (
      !credential ||
      credential.revokedAt ||
      +credential.expiresAt <= now ||
      !timingSafeEqual(Buffer.from(hash), Buffer.from(credential.secretHash))
    )
      throw new UnauthorizedError()
    return credential
  }

  /**
   * The uploader, locked for writing only if this batch may add to their agents.
   * A product that has an agent keeps one, so the look before the lock holds.
   */
  private async lockUploader(
    tx: EntityManager,
    credential: AgentCredential,
    events: AgentEventV1[],
  ): Promise<User> {
    const seen = await tx.findOneOrFail(User, {
      where: { id: credential.userId },
    })
    const adds =
      credential.mode === 'timer' &&
      events.some(
        (e) =>
          !e.source.agent &&
          e.source.product in AGENT_PRODUCT_NAMES &&
          !seen.agents?.some((a) => a.product === e.source.product),
      )

    return tx.findOneOrFail(User, {
      where: { id: credential.userId },
      lock: { mode: adds ? 'pessimistic_write' : 'pessimistic_read' },
    })
  }

  /**
   * Whether to lock a project for writing, because this batch may attach an
   * agent to it. The uploader's agents are locked by now and attachments are
   * only ever added, so a project that needs none will still need none.
   */
  private async attachesTo(
    tx: EntityManager,
    projectId: string,
    user: User,
    credential: AgentCredential,
    events: AgentEventV1[],
  ): Promise<boolean> {
    if (credential.mode !== 'timer') return false
    const seen = await tx.findOneBy(Project, { id: projectId })
    if (!seen) return false

    return events.some((e) => {
      if (e.projectId !== projectId || e.source.agent) return false
      const agent = agentForMachine(
        user.agents ?? [],
        e.source.product,
        credential.instanceId,
      )

      return !seen.agentAttachments?.some(
        (a) => a.agentId === agent?.id && a.workerId === user.id,
      )
    })
  }

  /**
   * A laptop collector uploads runs without naming an agent, so they went to
   * the worker's default agent for the product, attached to the project -
   * which nobody had set up, and every run waited (AGENT_NOT_ATTACHED). Now
   * a worker who never had an agent for the product gets a default one, and
   * a project that opted in with trackAgents gets it attached at 0/hour
   * until the worker sets a rate. The worker's own choices stand: an agent
   * they removed is not recreated, one they detached is not reattached, and
   * server collectors, which name their agent, are not touched. An event
   * refused whoever sent it provisions nothing.
   */
  private async provisionDefaults(
    tx: EntityManager,
    credential: AgentCredential,
    user: User,
    projects: Map<string, Project | null>,
    events: AgentEventV1[],
    now: number,
  ): Promise<void> {
    if (credential.mode !== 'timer') return
    const unnamed = events.filter((e) => {
      const project = projects.get(e.projectId)

      return (
        !e.source.agent &&
        project &&
        !eventRefusal(project, e, Date.parse(e.occurredAt), now)
      )
    })
    if (!unnamed.length) return
    const agents = user.agents ?? []
    const at = new Date(now).toISOString()
    let created = false
    for (const product of new Set(unnamed.map((e) => e.source.product))) {
      if (!(product in AGENT_PRODUCT_NAMES)) continue
      if (agents.some((a) => a.product === product)) continue
      let slug = product
      for (let n = 2; agents.some((a) => a.slug === slug); n++)
        slug = `${product}-${n}`
      agents.push({
        id: randomUUID(),
        name: AGENT_PRODUCT_NAMES[product as keyof typeof AGENT_PRODUCT_NAMES],
        slug,
        product,
        isDefault: true,
        bindings: [],
        createdAt: at,
        removedAt: null,
      })
      created = true
    }
    user.agents = agents
    if (created) await tx.update(User, user.id, { agents })
    for (const projectId of [...new Set(unnamed.map((e) => e.projectId))]) {
      const project = projects.get(projectId)!
      const attachments = project.agentAttachments ?? []
      let attached = false
      for (const product of new Set(
        unnamed
          .filter((e) => e.projectId === projectId)
          .map((e) => e.source.product),
      )) {
        const agent = agentForMachine(agents, product, credential.instanceId)
        if (
          !agent ||
          attachments.some(
            (a) => a.agentId === agent.id && a.workerId === user.id,
          )
        )
          continue
        attachments.push({
          agentId: agent.id,
          workerId: user.id,
          rateHourCents: 0,
          rateChanges: [],
          attachedAt: at,
          detachedAt: null,
        })
        attached = true
      }
      project.agentAttachments = attachments
      if (attached)
        await tx.update(Project, project.id, {
          agentAttachments: attachments,
        })
    }
  }

  /** One event's result, and its stored evidence unless it is refused. */
  private async store(
    tx: EntityManager,
    event: AgentEventV1,
    project: Project | null,
    credential: AgentCredential,
    user: User,
    now: number,
  ): Promise<IngestResult> {
    if (!project)
      return {
        eventId: event.eventId,
        status: 'rejected',
        code: 'PROJECT_UNAVAILABLE',
      }
    const payloadHash = AgentRepository.hash(AgentRunRecord.canonical(event))
    const existing = await tx.findOneBy(AgentEvent, {
      userId: user.id,
      instanceId: credential.instanceId,
      eventId: event.eventId,
    })
    if (existing) {
      const samePayload =
        existing.payloadHash === payloadHash ||
        AgentRepository.hash(
          AgentRunRecord.canonical(AgentIdentity.event(existing.payload)),
        ) === payloadHash
      if (!samePayload)
        return {
          eventId: event.eventId,
          status: 'rejected',
          code: 'EVENT_ID_CONFLICT',
        }
      return existing.code === 'RUN_INVOICED'
        ? {
            eventId: event.eventId,
            status: 'rejected',
            code: 'RUN_INVOICED',
          }
        : { eventId: event.eventId, status: 'duplicate' }
    }
    const runKey = AgentRunRecord.runKey(user.id, event)
    const previous = await tx.findOneBy(AgentEvent, { runKey })
    const row = await tx.findOne(TimeAgent, {
      where: { runKey },
      withDeleted: true,
      lock: { mode: 'pessimistic_write' },
    })
    const assigned = AgentRunRecord.assignedAgent(
      user,
      event,
      credential,
      previous,
    )
    const code = rejectionCode({
      project,
      event,
      row,
      previous,
      assigned,
      credential,
      user,
      now,
    })
    if (code) return { eventId: event.eventId, status: 'rejected', code }
    await tx.save(
      AgentEvent,
      tx.create(AgentEvent, {
        userId: user.id,
        projectId: project.id,
        instanceId: credential.instanceId,
        eventId: event.eventId,
        payloadHash,
        runKey,
        workerAgentId: assigned!.id,
        mode: credential.mode,
        payload: event,
        status: row?.invoiceId ? 'quarantined' : 'pending',
        code: row?.invoiceId ? 'RUN_INVOICED' : null,
      }),
    )
    return row?.invoiceId
      ? {
          eventId: event.eventId,
          status: 'rejected',
          code: 'RUN_INVOICED',
        }
      : { eventId: event.eventId, status: 'accepted' }
  }

  private static assignedAgent(
    user: User,
    event: AgentEventV1,
    credential: AgentCredential,
    previous: AgentEvent | null,
  ): WorkerAgent | undefined {
    const live = (user.agents ?? []).filter(
      (a) => !a.removedAt && a.product === event.source.product,
    )
    if (previous) return live.find((a) => a.id === previous.workerAgentId)
    if (event.source.agent)
      return live.find((a) => a.slug === event.source.agent)
    return agentForMachine(
      user.agents ?? [],
      event.source.product,
      credential.instanceId,
    )
  }

  private async projectRun(
    tx: EntityManager,
    runKey: string,
    now: number,
  ): Promise<void> {
    // Seen with the rotated ones too: runKey stays unique across them, and a
    // rotated run does not come back because a late event arrived for it.
    const existing = await tx.findOne(TimeAgent, {
      where: { runKey },
      withDeleted: true,
      lock: { mode: 'pessimistic_write' },
    })
    if (existing?.invoiceId) return
    if (existing?.deletedAt) {
      await tx.update(
        AgentEvent,
        { runKey, status: 'pending' },
        { status: 'processed', code: null },
      )
      return
    }
    const records = await tx.findBy(AgentEvent, { runKey })
    const candidates = records.filter((e) => e.code !== 'RUN_INVOICED')
    if (!candidates.length) return
    const projected = AgentTimeNormalizer.project(
      // Older JSON payloads retain their original UUID casing. Normalize copies
      // for replay so one producer epoch never becomes two ordering streams.
      candidates.map((e) => AgentIdentity.event(e.payload)),
      candidates[0].mode,
      now,
    )
    if ('code' in projected) {
      await tx.update(
        AgentEvent,
        { runKey },
        {
          status:
            projected.code === 'MISSING_START' ? 'pending' : 'quarantined',
          code: projected.code,
        },
      )
      // A prior successful prefix cannot survive once its evidence is invalid.
      // Keep the events for diagnostics; replay must converge across batch boundaries.
      if (existing) await tx.delete(TimeAgent, existing.id)
      return
    }
    const { start } = projected
    const first = candidates[0]
    const run = tx.create(TimeAgent, {
      ...existing,
      runKey,
      userId: first.userId,
      projectId: first.projectId,
      agentId: first.workerAgentId,
      product: start.source.product,
      surface: start.source.surface,
      sourceInstanceId: start.source.instanceId,
      sourceSessionId: start.sessionId,
      sourceRunId: start.runId,
      sourceAgentId: start.agentId,
      fromAt: projected.fromAt,
      toAt: projected.toAt,
      status: projected.status,
      segments: projected.segments,
      prompt: ('prompt' in start && start.prompt) || null,
      measurement: {
        coverage: 'run',
        mode: first.mode,
        waitCoverage: 'none',
        liveness: start.capabilities.liveness === true,
        provisional: projected.provisional,
        qualification: 'unqualified',
        normalizerRevision: 1,
        adapterVersion: start.source.adapterVersion,
        runtimeVersion: start.source.runtimeVersion,
        schemaVersion: start.schemaVersion,
      },
    })
    await tx.save(run)
    await tx.update(AgentEvent, { runKey }, { status: 'processed', code: null })
  }

  /**
   * Free-tier retention: past the same window as human time, a project owned by
   * a non-premium account rotates its runs when new events arrive for it. Runs
   * on an invoice stay as its evidence. Soft, so it stays reversible on upgrade.
   * See TimeRepository.softDeleteExpiredEntriesForProjects.
   */
  private async rotate(projectIds: string[]): Promise<void> {
    if (!projectIds.length) return
    await getDataSource()
      .createQueryBuilder()
      .softDelete()
      .from(TimeAgent)
      .where('"projectId" IN (:...projectIds)', { projectIds })
      .andWhere('"fromAt" < :cutoff', { cutoff: TimeManager.retentionCutoff() })
      .andWhere('"invoiceId" IS NULL')
      .andWhere('"deletedAt" IS NULL')
      .execute()
  }

  /**
   * Finished: terminal and unchanged for the 60 s grace, or stale, meaning a
   * run the adapter observes continuously has had no evidence for 90 s. Both
   * are measured from receipt (`updatedAt`), not source time: a backlog can
   * arrive hours late, in several batches. A sparse hook run with no terminal
   * stays open until its Stop reconciles it.
   */
  private static finished(
    qb: SelectQueryBuilder<TimeAgent>,
    now: number,
  ): SelectQueryBuilder<TimeAgent> {
    return qb.andWhere(
      new Brackets((finished) =>
        finished
          .where('run.status IN (:...terminal) AND run.updatedAt <= :settled', {
            terminal: ['completed', 'failed', 'cancelled'],
            settled: new Date(now - 60000),
          })
          .orWhere(
            `run.measurement->>'liveness' = 'true' AND run.updatedAt <= :stale`,
            { stale: new Date(now - 90000) },
          ),
      ),
    )
  }

  private unbilled(
    tx: EntityManager,
    projectId: string,
    issuerId: string,
  ): SelectQueryBuilder<TimeAgent> {
    return AgentRunRecord.finished(
      tx
        .createQueryBuilder(TimeAgent, 'run')
        .where('run.userId=:user AND run.projectId=:project', {
          user: issuerId,
          project: projectId,
        })
        .andWhere('run.invoiceId IS NULL AND run.isPaid=false'),
      Date.now(),
    )
  }

  /**
   * What an invoice may bill, locked until the caller's transaction ends: the
   * issuer's finished, uninvoiced runs, all of them or those starting in a
   * period. A detached agent's past runs stay billable at its last rate.
   */
  public async billable(
    tx: EntityManager,
    project: Project,
    issuerId: string,
    span: { from: Date; to: Date } | 'all',
  ): Promise<TimeAgent[]> {
    const select = () => {
      const qb = this.unbilled(tx, project.id, issuerId)
      if (span !== 'all')
        qb.andWhere('run.fromAt >= :from AND run.fromAt < :to', {
          from: span.from,
          to: span.to,
        })
      return qb
    }
    const attached = (run: TimeAgent) =>
      (project.agentAttachments ?? []).some(
        (a) => a.agentId === run.agentId && a.workerId === run.userId,
      )
    const candidates = (await select().getMany()).filter(attached)
    if (!candidates.length) return []
    // Ingestion takes these run locks before row locks; keep the same order.
    for (const key of candidates.map((run) => run.runKey).sort())
      await this.lock(tx, `agent:${key}`)
    return (
      await select()
        .andWhere('run.id IN (:...ids)', { ids: candidates.map((r) => r.id) })
        .orderBy('run.id')
        .setLock('pessimistic_write')
        .getMany()
    ).filter(attached)
  }

  public async hasBillable(
    projectId: string,
    issuerId: string,
  ): Promise<boolean> {
    return Boolean(
      await this.unbilled(
        getDataSource().manager,
        projectId,
        issuerId,
      ).getCount(),
    )
  }

  /** From here late events for these runs are set aside, never applied. */
  public async bill(
    tx: EntityManager,
    runs: TimeAgent[],
    invoiceId: string,
  ): Promise<void> {
    if (!runs.length) return
    await tx.update(
      TimeAgent,
      { id: In(runs.map((run) => run.id)) },
      { invoiceId },
    )
  }

  /** The issuer's runs on an invoice follow its payment. */
  public async setPaid(
    tx: EntityManager,
    invoiceId: string,
    issuerId: string,
    isPaid: boolean,
  ): Promise<void> {
    await tx.update(TimeAgent, { invoiceId, userId: issuerId }, { isPaid })
  }

  /** Rejection releases frozen evidence and applies quarantined corrections atomically. */
  public async release(tx: EntityManager, invoiceId: string): Promise<void> {
    const runs = await tx.findBy(TimeAgent, { invoiceId })
    for (const run of runs.sort((a, b) => a.runKey.localeCompare(b.runKey))) {
      await this.lock(tx, `agent:${run.runKey}`)
      await tx.update(
        TimeAgent,
        { id: run.id, invoiceId },
        { invoiceId: null, isPaid: false },
      )
      await tx.update(
        AgentEvent,
        { runKey: run.runKey, code: 'RUN_INVOICED' },
        { status: 'pending', code: null },
      )
      await this.projectRun(tx, run.runKey, Date.now())
    }
  }

  public async search(
    user: User,
    query: AgentSearchDto,
    now = Date.now(),
  ): Promise<[TimeAgent[], number]> {
    if (
      query.fromAt &&
      query.toAt &&
      Date.parse(query.toAt) <= Date.parse(query.fromAt)
    )
      throw new BadRequestError('INVALID_RANGE')
    return getDataSource().transaction(async (tx) => {
      const projects = query.projectId
        ? [await this.agents.project(tx, query.projectId, user, false)]
        : await this.workerProjects(tx, user)
      if (!projects.length) return [[], 0]
      const owned = projects.filter((p) => p.isOwner(user)).map((p) => p.id)
      const qb = tx
        .createQueryBuilder(TimeAgent, 'run')
        .where('run.projectId IN (:...projectIds)', {
          projectIds: projects.map((p) => p.id),
        })
        .andWhere(
          owned.length
            ? '(run.projectId IN (:...owned) OR run.userId = :userId)'
            : 'run.userId = :userId',
          { owned, userId: user.id },
        )
      if (query.fromAt)
        qb.andWhere('run.toAt >= :fromAt', { fromAt: query.fromAt })
      if (query.toAt) qb.andWhere('run.fromAt < :toAt', { toAt: query.toAt })
      const [runs, count] = await qb
        .orderBy('run.fromAt', 'DESC')
        .addOrderBy('run.id', 'ASC')
        .skip(query.offset ?? 0)
        .take(100)
        .getManyAndCount()
      const windows = new Map(projects.map((p) => [p.id, p.reviewWindowHours]))
      for (const run of runs) this.holdPrompt(run, user, windows, now)
      return [runs, count]
    })
  }

  /**
   * A prompt is detail, like a screenshot: another worker's reaches the
   * owner only once their review window has passed or the run is invoiced.
   */
  private holdPrompt(
    run: TimeAgent,
    user: User,
    windows: Map<string, number | null | undefined>,
    now: number,
  ): void {
    if (run.userId === user.id || run.invoiceId) return
    if (this.access.reviewEnded(run.toAt, windows.get(run.projectId), now))
      return
    if (run.prompt) run.promptPendingReview = true
    run.prompt = null
  }

  /** Every live project `user` owns or works on. */
  private async workerProjects(
    tx: EntityManager,
    user: User,
  ): Promise<Project[]> {
    const qb = tx
      .createQueryBuilder(Project, 'p')
      .innerJoinAndSelect('p.user', 'owner')
      .where('p.deletedAt IS NULL')

    this.access.filterProjects(
      qb,
      { project: 'p', owner: 'owner' },
      user,
      'worker',
    )

    return qb.getMany()
  }

  public async status(user: User) {
    const diagnostics = await getDataSource()
      .getRepository(AgentEvent)
      .createQueryBuilder('event')
      .select('event.code', 'code')
      .addSelect('event.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .where('event.userId = :id', { id: user.id })
      .andWhere('event.status != :processed', { processed: 'processed' })
      .groupBy('event.code')
      .addGroupBy('event.status')
      .getRawMany()
    return {
      credentials: await this.agents.credentials(user),
      diagnostics,
      qualification: 'unqualified',
      qualifiedAdapters: [],
    }
  }

  private async lock(tx: EntityManager, key: string): Promise<void> {
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      key,
    ])
  }

  public static runKey(userId: string, e: AgentEventV1): string {
    return createHash('sha256')
      .update(
        JSON.stringify([
          userId,
          e.source.product,
          e.source.instanceId.toLowerCase(),
          e.sessionId,
          e.runId,
          e.agentId,
        ]),
      )
      .digest('hex')
  }

  private static canonical(value: unknown): string {
    if (Array.isArray(value))
      return `[${value.map((v) => this.canonical(v)).join(',')}]`
    if (value && typeof value === 'object')
      return `{${Object.keys(value)
        .sort()
        .map(
          (k) =>
            `${JSON.stringify(k)}:${this.canonical((value as Record<string, unknown>)[k])}`,
        )
        .join(',')}}`
    return JSON.stringify(value)
  }
}
