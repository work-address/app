import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm'
import { AbstractBaseEntity } from '@/entity/abstract-base-entity'
import { User } from '@/entity/user'
import { Project } from '@/entity/project'
import { Invoice } from '@/entity/invoice'
import { AgentSegment } from '@/model/agent'

@Entity('time_agent')
@Index(['projectId', 'fromAt'])
@Index(['userId', 'fromAt'])
export class TimeAgent extends AbstractBaseEntity {
  @Index({ unique: true }) @Column('varchar', { length: 64 }) runKey: string
  @Column('uuid') userId: string
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User
  @Column('uuid') projectId: string
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project
  @Column('uuid') agentId: string
  @Column('text') product: string
  @Column('text') surface: string
  @Column('uuid') sourceInstanceId: string
  @Column('text') sourceSessionId: string
  @Column('text') sourceRunId: string
  @Column('text') sourceAgentId: string
  @Column('timestamptz') fromAt: Date
  @Column('timestamptz') toAt: Date
  @Column('text') status: string
  @Column('jsonb') segments: AgentSegment[]
  @Column('jsonb') measurement: {
    coverage: 'run'
    mode: 'timer' | 'fixed'
    waitCoverage: 'none'
    provisional: boolean
    qualification: 'unqualified'
    normalizerRevision: number
    adapterVersion: string
    runtimeVersion: string
    schemaVersion: number
  }
  @Column('bool', { default: false }) manual: boolean
  @Column('bool', { default: false }) isPaid: boolean
  @Index() @Column('uuid', { nullable: true }) invoiceId: string | null
  @ManyToOne(() => Invoice, { nullable: true })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice | null
}
