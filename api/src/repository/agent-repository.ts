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
import { Refused, WorkerAgents } from '@/service/worker-agents'

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
    return getDataSource().transaction(async (tx) => {
      const stored = await tx.findOneOrFail(User, {
        where: { id: user.id },
        lock: { mode: 'pessimistic_write' },
      })
      const saved = AgentRepository.allowed(
        WorkerAgents.save(stored.agents ?? [], data, create, {
          at: new Date().toISOString(),
          newId: randomUUID,
        }),
      )
      await tx.update(User, user.id, { agents: saved.agents })
      return saved.agent
    })
  }

  public async remove(user: User, id: string): Promise<void> {
    await getDataSource().transaction(async (tx) => {
      const stored = await tx.findOneOrFail(User, {
        where: { id: user.id },
        lock: { mode: 'pessimistic_write' },
      })
      const removed = AgentRepository.allowed(
        WorkerAgents.remove(stored.agents ?? [], id, new Date().toISOString()),
      )
      if (removed.changed)
        await tx.update(User, user.id, { agents: removed.agents })
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
      return WorkerAgents.visibleTo(project.agentAttachments ?? [], {
        id: user.id,
        isOwner: project.isOwner(user),
        canWork: true,
      })
    })
  }

  public async attach(
    user: User,
    projectId: string,
    agentId: string,
    rateHourCents: number | null,
  ): Promise<AgentAttachment> {
    return getDataSource().transaction(async (tx) => {
      const stored = await tx.findOneOrFail(User, {
        where: { id: user.id },
        lock: { mode: 'pessimistic_read' },
      })
      const project = await this.project(tx, projectId, user, true)
      const attached = AgentRepository.allowed(
        WorkerAgents.attach(
          stored.agents ?? [],
          project.agentAttachments ?? [],
          {
            workerId: user.id,
            agentId,
            rateHourCents,
            at: new Date().toISOString(),
          },
        ),
      )
      await tx.update(Project, project.id, {
        agentAttachments: attached.attachments,
      })
      return attached.attachment
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

  /**
   * Plain objects, not entities: the base entity exposes `id` and `createdAt`
   * only to some serialization groups, and an entity returned as is would
   * reach the client without the id that revoking it takes.
   */
  public async credentials(user: User) {
    const credentials = await getDataSource()
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
    return credentials.map((credential) => ({ ...credential }))
  }

  public async revoke(user: User, id: string): Promise<void> {
    const result = await getDataSource()
      .getRepository(AgentCredential)
      .update({ id, userId: user.id }, { revokedAt: new Date() })
    if (!result.affected) throw new NotFoundError()
  }

  /** The change, or the error its refusal has always been answered with. */
  private static allowed<T extends object>(result: T | Refused): T {
    if (!('refused' in result)) return result
    if (result.refused === 'NOT_FOUND') throw new NotFoundError()
    if (result.refused === 'NOT_OWN_AGENT') throw new ForbiddenError()
    throw new BadRequestError(result.refused)
  }

  public static hash(value: string): string {
    return createHash('sha256').update(value).digest('hex')
  }
}
