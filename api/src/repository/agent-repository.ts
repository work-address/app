import { createHash, randomBytes, randomUUID } from 'crypto'
import { inject, injectable } from 'inversify'
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from 'routing-controllers'
import { EntityManager } from 'typeorm'
import { getDataSource } from '@/connector/data-source'
import { User } from '@/entity/user'
import { Project } from '@/entity/project'
import { AgentCredential } from '@/entity/agent-credential'
import { AgentAttachment, WorkerAgent } from '@/model/agent'
import { AgentCredentialDto, AgentDto } from '@/model/dto/agent'
import { ProjectAccess } from '@/service/project-access'

/**
 * A worker's agents, where they are attached, and the credentials their
 * machines upload with. What happens to the runs is `AgentRunRecord`.
 */
@injectable()
export class AgentRepository {
  @inject('ProjectAccess') private access: ProjectAccess

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

  public async project(
    tx: EntityManager,
    id: string,
    user: User,
    write: boolean,
  ): Promise<Project> {
    const project = await this.workerProject(tx, id, user, write)
    if (!project) throw new ForbiddenError()
    return project
  }

  /** The project if it exists and `user` works on it; never says which is missing. */
  public async workerProject(
    tx: EntityManager,
    id: string,
    user: User,
    write: boolean,
  ): Promise<Project | null> {
    const project = await tx
      .createQueryBuilder(Project, 'p')
      .innerJoinAndSelect('p.user', 'owner')
      .where('p.id = :id', { id })
      .setLock(write ? 'pessimistic_write' : 'pessimistic_read', undefined, [
        'p',
      ])
      .getOne()
    return project && this.access.canWork(project, user) ? project : null
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

  public static hash(value: string): string {
    return createHash('sha256').update(value).digest('hex')
  }
}
