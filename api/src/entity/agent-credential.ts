import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm'
import { AbstractBaseEntity } from '@/entity/abstract-base-entity'
import { User } from '@/entity/user'

@Entity()
export class AgentCredential extends AbstractBaseEntity {
  @Column('uuid') userId: string
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User
  @Column('uuid') instanceId: string
  @Index({ unique: true }) @Column('varchar', { length: 64 }) secretHash: string
  @Column('varchar', { length: 12 }) prefix: string
  @Column('varchar', { length: 60 }) label: string
  @Column('varchar', { length: 10 }) mode: 'timer' | 'fixed'
  @Column('timestamptz') expiresAt: Date
  @Column('timestamptz', { nullable: true }) revokedAt: Date | null
  @Column('timestamptz', { nullable: true }) lastUsedAt: Date | null
  @Column('jsonb', { nullable: true }) health:
    | import('@work-address/agent-tracking-contract').CollectorHealthV1
    | null
  @Column('timestamptz', { nullable: true }) lastHealthAt: Date | null
  @Column('float', { default: 600 }) tokens: number
  @Column('timestamptz', { default: () => 'CURRENT_TIMESTAMP' }) refillAt: Date
}
