import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { Time } from '@/entity/time'

@Entity('app_usage')
@Index('UQ_APP_USAGE_KEY', ['time', 'identity'], { unique: true })
export class AppUsage {
  @PrimaryGeneratedColumn('uuid') id: string
  @ManyToOne(() => Time, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'timeId' })
  @Index()
  time: Time
  // Hash of the normalized tuple; nulls compare equally without a PG-version-specific index.
  @Column('text') identity: string
  @Column('varchar', { length: 200 }) app: string
  @Column('varchar', { length: 200, nullable: true }) title: string | null
  @Column('varchar', { length: 253, nullable: true }) domain: string | null
  @Column('int') seconds: number
}
