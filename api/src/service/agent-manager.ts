import { inject, injectable } from 'inversify'
import { BadRequestError, HttpError } from 'routing-controllers'
import {
  MAX_EVENT_BYTES,
  ingestBatchSchema,
} from '@work-address/agent-tracking-contract'
import { User } from '@/entity/user'
import { AgentCredentialDto, AgentDto, AgentSearchDto } from '@/model/dto/agent'
import { AgentRepository } from '@/repository/agent-repository'

@injectable()
export class AgentManager {
  @inject('AgentRepository') private repository: AgentRepository

  public list(user: User) {
    return this.repository.list(user)
  }
  public save(user: User, data: AgentDto, create: boolean) {
    return this.repository.save(user, data, create)
  }
  public remove(user: User, id: string) {
    return this.repository.remove(user, id)
  }
  public attachments(user: User, projectId: string) {
    return this.repository.attachments(user, projectId)
  }
  public attach(
    user: User,
    projectId: string,
    agentId: string,
    rate: number | null,
  ) {
    return this.repository.attach(user, projectId, agentId, rate)
  }
  public issue(user: User, data: AgentCredentialDto) {
    return this.repository.issue(user, data)
  }
  public credentials(user: User) {
    return this.repository.credentials(user)
  }
  public revoke(user: User, id: string) {
    return this.repository.revoke(user, id)
  }
  public search(user: User, query: AgentSearchDto) {
    if (
      query.fromAt &&
      query.toAt &&
      Date.parse(query.toAt) <= Date.parse(query.fromAt)
    )
      throw new BadRequestError('INVALID_RANGE')
    return this.repository.search(user, query)
  }
  public status(user: User) {
    return this.repository.status(user)
  }

  public ingest(authorization: string | undefined, body: unknown) {
    if (process.env.AGENT_TRACKING_ENABLED !== 'true')
      throw new HttpError(503, 'AGENT_TRACKING_DISABLED')
    const parsed = ingestBatchSchema.safeParse(body)
    if (!parsed.success) throw new BadRequestError('INVALID_ENVELOPE')
    if (
      parsed.data.events.some(
        (event) => Buffer.byteLength(JSON.stringify(event)) > MAX_EVENT_BYTES,
      )
    )
      throw new HttpError(413, 'EVENT_TOO_LARGE')
    return this.repository.ingest(
      (authorization ?? '').replace(/^Bearer /, ''),
      parsed.data.events,
      parsed.data.health,
    )
  }
}
