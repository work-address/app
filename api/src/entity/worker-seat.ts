import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * One stretch of a connected worker being on an owner's bill. Billing charges
 * the highest count during a period, and that cannot be worked out afterwards
 * from project lists, which only say who is on them now.
 */
@Entity('worker_seat')
@Index('UQ_WORKER_SEAT_OPEN', ['ownerId', 'workerAddress'], {
  unique: true,
  where: '"endedAt" IS NULL',
})
export class WorkerSeat {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column('uuid')
  ownerId: string

  /** Canonical form, as `AccountAddress.toCanonical`. */
  @Column('text')
  workerAddress: string

  @Column('timestamptz')
  startedAt: Date

  @Column('timestamptz', { nullable: true })
  endedAt: Date | null
}
