import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto'
import { inject, injectable } from 'inversify'
import {
  BadRequestError,
  ForbiddenError,
  HttpError,
  NotFoundError,
  UnauthorizedError,
} from 'routing-controllers'
import { EntityManager } from 'typeorm'
import { getDataSource } from '@/connector/data-source'
import { User } from '@/entity/user'
import { Project } from '@/entity/project'
import { AgentCredential } from '@/entity/agent-credential'
import { AgentEvent } from '@/entity/agent-event'
import { TimeAgent } from '@/entity/time-agent'
import { EProjectState } from '@/model/project'
import { AgentAttachment, WorkerAgent } from '@/model/agent'
import { AgentCredentialDto, AgentDto, AgentSearchDto } from '@/model/dto/agent'
import { Entitlement } from '@/service/entitlement'
import { AgentTimeNormalizer } from '@/service/agent-time-normalizer'
import { AgentIdentity } from '@/service/agent-identity'
import type {
  AgentEventV1,
  IngestResult,
  CollectorHealthV1,
} from '@work-address/agent-tracking-contract'

@injectable()
export class AgentRepository {
  @inject('Entitlement') private entitlement: Entitlement

  public async list(user: User): Promise<WorkerAgent[]> {
    const stored = await getDataSource()
      .getRepository(User)
      .findOneByOrFail({ id: user.id })
    return stored.agents ?? []
  }

  public async save(
    user: User,
    data: AgentDto,
    create: boolean,
  ): Promise<WorkerAgent> {
    data = {
      ...data,
      id: data.id?.toLowerCase(),
      bindings: data.bindings.map((id) => id.toLowerCase()),
    }
    if (new Set(data.bindings).size !== data.bindings.length)
      throw new BadRequestError('DUPLICATE_BINDING')
    return getDataSource().transaction(async (tx) => {
      const stored = await tx.findOneOrFail(User, {
        where: { id: user.id },
        lock: { mode: 'pessimistic_write' },
      })
      const agents = stored.agents ?? []
      const prior = create
        ? undefined
        : agents.find((a) => a.id === data.id && !a.removedAt)
      if (!create && !prior) throw new NotFoundError()
      if (create && agents.length >= 100)
        throw new BadRequestError('AGENT_LIMIT')
      if (prior && prior.product !== data.product)
        throw new BadRequestError('PRODUCT_IMMUTABLE')
      if (agents.some((a) => a.id !== prior?.id && a.slug === data.slug))
        throw new BadRequestError('SLUG_IN_USE')
      if (
        agents.some(
          (a) =>
            !a.removedAt &&
            a.id !== prior?.id &&
            a.product === data.product &&
            a.bindings.some((b) => data.bindings.includes(b.toLowerCase())),
        )
      )
        throw new BadRequestError('BINDING_IN_USE')
      const agent: WorkerAgent = {
        ...data,
        id: prior?.id ?? randomUUID(),
        createdAt: prior?.createdAt ?? new Date().toISOString(),
        removedAt: null,
      }
      const peers = agents.filter(
        (a) => a.id !== agent.id && !a.removedAt && a.product === agent.product,
      )
      // A product always has one default; selecting a new one replaces it atomically.
      agent.isDefault = data.isDefault || !peers.some((a) => a.isDefault)
      if (agent.isDefault) for (const peer of peers) peer.isDefault = false
      stored.agents = [...agents.filter((a) => a.id !== agent.id), agent]
      await tx.update(User, user.id, { agents: stored.agents })
      return agent
    })
  }

  public async remove(user: User, id: string): Promise<void> {
    id = id.toLowerCase()
    await getDataSource().transaction(async (tx) => {
      const stored = await tx.findOneOrFail(User, {
        where: { id: user.id },
        lock: { mode: 'pessimistic_write' },
      })
      const agent = stored.agents?.find((a) => a.id === id)
      if (!agent) throw new NotFoundError()
      if (agent.removedAt) return
      agent.removedAt = new Date().toISOString()
      agent.isDefault = false
      agent.bindings = []
      const peers = stored.agents.filter(
        (a) => !a.removedAt && a.product === agent.product,
      )
      if (peers.length && !peers.some((a) => a.isDefault))
        peers[0].isDefault = true
      await tx.update(User, user.id, { agents: stored.agents })
    })
  }

  private async project(
    tx: EntityManager,
    id: string,
    user: User,
    write: boolean,
  ): Promise<Project> {
    const project = await tx
      .createQueryBuilder(Project, 'p')
      .innerJoinAndSelect('p.user', 'owner')
      .where('p.id = :id', { id })
      .setLock(write ? 'pessimistic_write' : 'pessimistic_read', undefined, [
        'p',
      ])
      .getOne()
    if (
      !project ||
      !project.isWorker(user, this.entitlement.isPremium(project.user))
    )
      throw new ForbiddenError()
    return project
  }

  public async attachments(
    user: User,
    projectId: string,
  ): Promise<AgentAttachment[]> {
    return getDataSource().transaction(async (tx) => {
      const project = await this.project(tx, projectId, user, false)
      return (project.agentAttachments ?? []).filter(
        (a) => project.isOwner(user) || a.workerId === user.id,
      )
    })
  }

  public async attach(
    user: User,
    projectId: string,
    agentId: string,
    rateHourCents: number | null,
  ): Promise<AgentAttachment> {
    agentId = agentId.toLowerCase()
    return getDataSource().transaction(async (tx) => {
      const stored = await tx.findOneOrFail(User, {
        where: { id: user.id },
        lock: { mode: 'pessimistic_read' },
      })
      if (!stored.agents?.some((a) => a.id === agentId && !a.removedAt))
        throw new ForbiddenError()
      const project = await this.project(tx, projectId, user, true)
      const attachments = project.agentAttachments ?? []
      let attachment = attachments.find(
        (a) => a.agentId === agentId && a.workerId === user.id,
      )
      const now = new Date().toISOString()
      if (!attachment) {
        if (rateHourCents === null) throw new NotFoundError()
        attachment = {
          agentId,
          workerId: user.id,
          rateHourCents: 0,
          rateChanges: [],
          attachedAt: now,
          detachedAt: null,
        }
        attachments.push(attachment)
      }
      if (rateHourCents === null) attachment.detachedAt = now
      else {
        if (attachment.rateHourCents !== rateHourCents)
          attachment.rateChanges.push({
            at: now,
            fromCents: attachment.rateHourCents,
            toCents: rateHourCents,
            changedBy: user.id,
          })
        attachment.rateHourCents = rateHourCents
        attachment.detachedAt = null
      }
      await tx.update(Project, project.id, { agentAttachments: attachments })
      return attachment
    })
  }

  public async issue(user: User, data: AgentCredentialDto) {
    const credential = `wa_agent_${randomBytes(32).toString('hex')}`
    const expiresAt = new Date(Date.now() + 90 * 86400000)
    const repo = getDataSource().getRepository(AgentCredential)
    const row = await repo.save(
      repo.create({
        userId: user.id,
        instanceId: data.instanceId.toLowerCase(),
        mode: data.mode,
        label: data.label ?? '',
        prefix: credential.slice(0, 12),
        secretHash: AgentRepository.hash(credential),
        expiresAt,
      }),
    )
    return {
      id: row.id,
      instanceId: row.instanceId,
      credential,
      expiresAt: expiresAt.toISOString(),
    }
  }

  public async credentials(user: User) {
    return getDataSource()
      .getRepository(AgentCredential)
      .find({
        where: { userId: user.id },
        select: {
          id: true,
          instanceId: true,
          label: true,
          mode: true,
          prefix: true,
          createdAt: true,
          expiresAt: true,
          revokedAt: true,
          lastUsedAt: true,
          health: true,
          lastHealthAt: true,
        },
        order: { createdAt: 'DESC' },
        take: 100,
      })
  }

  public async revoke(user: User, id: string): Promise<void> {
    const result = await getDataSource()
      .getRepository(AgentCredential)
      .update({ id, userId: user.id }, { revokedAt: new Date() })
    if (!result.affected) throw new NotFoundError()
  }

  public async ingest(
    secret: string,
    events: AgentEventV1[],
    health?: CollectorHealthV1,
  ): Promise<{ results: IngestResult[] }> {
    if (!/^wa_agent_[0-9a-f]{64}$/.test(secret)) throw new UnauthorizedError()
    // Keep the submitted spelling in acknowledgements for existing collectors.
    const submittedIds = events.map((event) => event.eventId)
    events = events.map((event) => AgentIdentity.event(event))
    return getDataSource().transaction(async (tx) => {
      const hash = AgentRepository.hash(secret)
      const credential = await tx.findOne(AgentCredential, {
        where: { secretHash: hash },
        lock: { mode: 'pessimistic_write' },
      })
      const now = Date.now()
      if (
        !credential ||
        credential.revokedAt ||
        +credential.expiresAt <= now ||
        !timingSafeEqual(Buffer.from(hash), Buffer.from(credential.secretHash))
      )
        throw new UnauthorizedError()
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
      const user = await tx.findOneOrFail(User, {
        where: { id: credential.userId },
        lock: { mode: 'pessimistic_read' },
      })
      // Validate all project/source scopes before accepting any event in a batch.
      const projects = new Map<string, Project>()
      for (const projectId of [
        ...new Set(events.map((e) => e.projectId)),
      ].sort())
        projects.set(projectId, await this.project(tx, projectId, user, false))
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
      for (const id of [...new Set(events.map((e) => e.eventId))].sort())
        await tx.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          [`agent-event:${user.id}:${credential.instanceId}:${id}`],
        )
      const results: IngestResult[] = []
      // Stable lock order across concurrent batches and credentials.
      for (const key of [
        ...new Set(events.map((e) => AgentRepository.runKey(user.id, e))),
      ].sort())
        await tx.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          [`agent:${key}`],
        )
      for (const event of events) {
        const project = projects.get(event.projectId)!
        const payloadHash = AgentRepository.hash(
          AgentRepository.canonical(event),
        )
        const existing = await tx.findOneBy(AgentEvent, {
          userId: user.id,
          instanceId: credential.instanceId,
          eventId: event.eventId,
        })
        if (existing) {
          const samePayload =
            existing.payloadHash === payloadHash ||
            AgentRepository.hash(
              AgentRepository.canonical(AgentIdentity.event(existing.payload)),
            ) === payloadHash
          results.push(
            samePayload
              ? existing.code === 'RUN_INVOICED'
                ? {
                    eventId: event.eventId,
                    status: 'rejected',
                    code: 'RUN_INVOICED',
                  }
                : { eventId: event.eventId, status: 'duplicate' }
              : {
                  eventId: event.eventId,
                  status: 'rejected',
                  code: 'EVENT_ID_CONFLICT',
                },
          )
          continue
        }
        const runKey = AgentRepository.runKey(user.id, event)
        const previous = await tx.findOneBy(AgentEvent, { runKey })
        const row = await tx.findOne(TimeAgent, {
          where: { runKey },
          lock: { mode: 'pessimistic_write' },
        })
        const productAgents = (user.agents ?? []).filter(
          (a) => !a.removedAt && a.product === event.source.product,
        )
        const assigned = previous
          ? productAgents.find((a) => a.id === previous.workerAgentId)
          : event.source.agent
            ? productAgents.find((a) => a.slug === event.source.agent)
            : (productAgents.find((a) =>
                a.bindings.some(
                  (id) => id.toLowerCase() === credential.instanceId,
                ),
              ) ?? productAgents.find((a) => a.isDefault))
        let code: string | null = null
        if (!project.trackAgents || project.state !== EProjectState.ACTIVE)
          code = 'AGENT_TRACKING_OFF'
        else if (
          project.agentTrackingSince &&
          (row ? +row.fromAt : Date.parse(event.occurredAt)) <
            +project.agentTrackingSince
        )
          code = 'AGENT_TRACKING_OFF'
        else if (Date.parse(event.occurredAt) < now - 7 * 86400000)
          code = 'REVISION_WINDOW_EXPIRED'
        else if (
          Date.parse(event.occurredAt) > now + 300000 ||
          Date.parse(event.observedAt) > now + 300000
        )
          code = 'FUTURE_TIMESTAMP'
        else if (
          previous &&
          (previous.projectId !== event.projectId ||
            previous.mode !== credential.mode ||
            previous.payload.source.agent !== event.source.agent)
        )
          code = 'RUN_SCOPE_MISMATCH'
        else if (
          !assigned ||
          !project.agentAttachments?.some(
            (a) =>
              a.agentId === assigned.id &&
              a.workerId === user.id &&
              !a.detachedAt,
          )
        )
          code = 'AGENT_NOT_ATTACHED'
        if (code) {
          results.push({ eventId: event.eventId, status: 'rejected', code })
          continue
        }
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
        results.push(
          row?.invoiceId
            ? {
                eventId: event.eventId,
                status: 'rejected',
                code: 'RUN_INVOICED',
              }
            : { eventId: event.eventId, status: 'accepted' },
        )
      }
      for (const runKey of [
        ...new Set(events.map((e) => AgentRepository.runKey(user.id, e))),
      ])
        await this.projectRun(tx, runKey, now)
      await tx.update(AgentCredential, credential.id, {
        ...(health ? { health, lastHealthAt: new Date(now) } : {}),
        lastUsedAt: new Date(now),
        tokens: available - events.length,
        refillAt: new Date(now),
      })
      return {
        results: results.map((result, index) => ({
          ...result,
          eventId: submittedIds[index],
        })),
      }
    })
  }

  private async projectRun(
    tx: EntityManager,
    runKey: string,
    now: number,
  ): Promise<void> {
    const existing = await tx.findOne(TimeAgent, {
      where: { runKey },
      lock: { mode: 'pessimistic_write' },
    })
    if (existing?.invoiceId) return
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
      measurement: {
        coverage: 'run',
        mode: first.mode,
        waitCoverage: 'none',
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

  /** Rejection releases frozen evidence and applies quarantined corrections atomically. */
  public async releaseInvoice(
    tx: EntityManager,
    invoiceId: string,
  ): Promise<void> {
    const runs = await tx.findBy(TimeAgent, { invoiceId })
    for (const run of runs.sort((a, b) => a.runKey.localeCompare(b.runKey))) {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        `agent:${run.runKey}`,
      ])
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

  public async search(user: User, query: AgentSearchDto) {
    return getDataSource().transaction(async (tx) => {
      const project = await this.project(tx, query.projectId, user, false)
      const qb = tx
        .createQueryBuilder(TimeAgent, 'run')
        .where('run.projectId = :projectId', { projectId: project.id })
      if (!project.isOwner(user))
        qb.andWhere('run.userId = :userId', { userId: user.id })
      if (query.fromAt)
        qb.andWhere('run.toAt >= :fromAt', { fromAt: query.fromAt })
      if (query.toAt) qb.andWhere('run.fromAt < :toAt', { toAt: query.toAt })
      return qb
        .orderBy('run.fromAt', 'DESC')
        .addOrderBy('run.id', 'ASC')
        .skip(query.offset ?? 0)
        .take(100)
        .getManyAndCount()
    })
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
      credentials: await this.credentials(user),
      diagnostics,
      qualification: 'unqualified',
      qualifiedAdapters: [],
    }
  }

  private static hash(value: string): string {
    return createHash('sha256').update(value).digest('hex')
  }
  public static runKey(userId: string, e: AgentEventV1): string {
    return this.hash(
      JSON.stringify([
        userId,
        e.source.product,
        e.source.instanceId.toLowerCase(),
        e.sessionId,
        e.runId,
        e.agentId,
      ]),
    )
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
