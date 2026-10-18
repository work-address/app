import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm'
import { AbstractBaseEntity } from '@/entity/abstract-base-entity'
import { User } from '@/entity/user'
import { Project } from '@/entity/project'
import type { AgentEventV1 } from '@work-address/agent-tracking-contract'

@Entity()
@Index(['userId', 'instanceId', 'eventId'], { unique: true })
@Index(['runKey', 'status'])
export class AgentEvent extends AbstractBaseEntity {
  @Column('uuid') userId: string
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User
  @Column('uuid') projectId: string
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project
  @Column('uuid') instanceId: string
  @Column('uuid') eventId: string
  @Column('varchar', { length: 64 }) payloadHash: string
  @Column('varchar', { length: 64 }) runKey: string
  @Column('uuid') workerAgentId: string
  @Column('varchar', { length: 10 }) mode: 'timer' | 'fixed'
  @Column('jsonb') payload: AgentEventV1
  @Column('text', { default: 'pending' }) status:
    | 'pending'
    | 'processed'
    | 'quarantined'
  @Column('text', { nullable: true }) code: string | null
}
