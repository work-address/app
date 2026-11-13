import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { Time } from '@/entity/time'

/**
 * One position a phone recorded while its timer ran on an entry, or one
 * attempt that found none. Part of the entry's detail, removed with it, and
 * cleared as its screenshot is: by its author or by retention.
 */
@Entity('time_location')
export class TimeLocation {
  @PrimaryGeneratedColumn('uuid') id: string
  @ManyToOne(() => Time, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'timeId' })
  @Index()
  time: Time
  /** When the phone took the fix, or tried to. */
  @Column('timestamptz') at: Date
  /** Null, with `longitude` and `accuracy`, for an attempt with no fix. */
  @Column('double precision', { nullable: true }) latitude: number | null
  @Column('double precision', { nullable: true }) longitude: number | null
  /** In metres. */
  @Column('double precision', { nullable: true }) accuracy: number | null
  /** The phone said the fix was faked. Kept, never refused. */
  @Column('bool', { default: false }) mock: boolean
}
