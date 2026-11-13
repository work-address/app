import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  Unique,
  RelationId,
} from 'typeorm'
import { faker } from '@faker-js/faker'
import { Exclude, Expose, Type } from 'class-transformer'
import { JSONSchema } from 'class-validator-jsonschema'

import { AbstractBaseEntity } from '@/entity/abstract-base-entity'
import { Invoice } from '@/entity/invoice'
import { Project } from '@/entity/project'
import { User } from '@/entity/user'
import { ITime } from '@/model/time'
import {
  Allow,
  IsArray,
  IsBoolean,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator'

@JSONSchema({
  example: {
    id: faker.string.uuid(),
  },
})
@Entity()
@Exclude()
@Unique('UQ_PROJECT_USER_FROM_AT', ['project', 'user', 'fromAt'])
export class Time extends AbstractBaseEntity implements ITime {
  @Expose({ groups: ['search'] })
  @Type(() => Project)
  @ManyToOne(() => Project, { eager: true, nullable: false })
  @JoinColumn({ name: 'projectId' })
  project: Project

  @Expose({ groups: ['search'] })
  @Type(() => User)
  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User

  @Expose({ groups: ['search', 'create', 'edit'] })
  /**
   * Whether this hour has been paid for.
   *
   * Owned by the invoice that covers it - `InvoiceManager.markPaid` sets it and
   * `markUnpaid` clears it - so the work record and the money record cannot
   * disagree. An invoice covering a period is what makes its entries paid;
   * nothing else should write this except a user correcting an entry directly.
   */
  @Column('bool', { nullable: true, default: false })
  @IsBoolean()
  @IsOptional()
  isPaid: boolean

  /**
   * The invoice that bills this entry, if any.
   *
   * An explicit link rather than "an invoice whose period overlaps mine":
   * entries can be invoiced in an arbitrary selection, so a period covering
   * Monday and Friday must not silently claim Tuesday through Thursday.
   *
   * Deliberately outside every serialisation group - which invoice an entry
   * belongs to is server-side bookkeeping, and exposing it would let a client
   * round-trip it back on an edit and move hours between invoices.
   */
  @ManyToOne(() => Invoice, { nullable: true, onDelete: 'SET NULL' })
  invoice?: Invoice | null

  /** Read-only: `invoice` writes it, and it answers without joining the row. */
  @RelationId((time: Time) => time.invoice)
  invoiceId?: string | null

  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  note: string | null

  // Under 300KB, ensure to use BYTEA
  @Expose({ groups: ['search', 'create'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  screenshot: string | null

  @Expose({ groups: ['search', 'create'] })
  @Column('jsonb', { nullable: true })
  @IsArray()
  @IsOptional()
  processes: ITime['processes']

  @Allow()
  @IsOptional()
  @JSONSchema({ type: 'string', nullable: true })
  @Expose({ groups: ['search'] })
  @Column('text', { nullable: true })
  appsStatus: string | null

  @Allow()
  @IsOptional()
  @JSONSchema({ type: 'string', nullable: true })
  @Expose({ groups: ['search'] })
  @Column('text', { nullable: true })
  appsReason: string | null

  @Allow()
  @IsOptional()
  @JSONSchema({ type: 'boolean', nullable: true })
  @Expose({ groups: ['search'] })
  @Column('bool', { default: false })
  appsTruncated: boolean = false

  @Allow()
  @IsOptional()
  @JSONSchema({ type: 'string', nullable: true })
  @Expose({ groups: ['search'] })
  @Column('text', { default: 'desktop' })
  source: 'desktop' | 'mobile' | 'manual' | 'web' = 'desktop'

  /**
   * What became of a phone entry's location: `ok` when it is kept, `off` when
   * the project did not ask for it, `removed` by its author, `expired` by
   * retention, `invalid` when the phone sent what could not be read, or what
   * else the phone said. Null on desktop entries. Shaped as `appsStatus` is.
   */
  @Allow()
  @IsOptional()
  @JSONSchema({ type: 'string', nullable: true })
  @Expose({ groups: ['search'] })
  @Column('text', { nullable: true })
  locationStatus: string | null

  /** The entry's fixes in time order, where the reader may see its detail. */
  @Allow()
  @IsOptional()
  @JSONSchema({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        at: { type: 'string', format: 'date-time' },
        latitude: { type: 'number', nullable: true },
        longitude: { type: 'number', nullable: true },
        accuracy: { type: 'number', nullable: true },
        mock: { type: 'boolean' },
      },
      required: ['at', 'latitude', 'longitude', 'accuracy', 'mock'],
    },
  })
  @Expose({ groups: ['search'] })
  locations?: {
    at: Date
    latitude: number | null
    longitude: number | null
    accuracy: number | null
    mock: boolean
  }[]

  @Allow()
  @IsOptional()
  @JSONSchema({ type: 'string', nullable: true })
  @Expose({ groups: ['search'] })
  @Column('timestamptz', { nullable: true })
  publishedAt: Date | null

  @Allow()
  @IsOptional()
  @JSONSchema({ type: 'boolean', nullable: true })
  @Expose({ groups: ['search'] })
  detailPendingReview?: boolean

  // Whether an invoice covers it, for a client to offer only what it would
  // accept. Which invoice stays server-side: see `invoice` above.
  @Allow()
  @IsOptional()
  @JSONSchema({ type: 'boolean', nullable: true })
  @Expose({ groups: ['search'] })
  isInvoiced?: boolean

  @Allow()
  @IsOptional()
  @JSONSchema({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        seconds: { type: 'number' },
        titles: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', nullable: true },
              domain: { type: 'string', nullable: true },
              seconds: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @Expose({ groups: ['search'] })
  apps?: {
    name: string
    seconds: number
    titles: { title: string | null; domain: string | null; seconds: number }[]
  }[]

  @Expose({ groups: ['search', 'create'] })
  @Column('int', { nullable: false })
  @IsNumber()
  keyboardKeys: number | null

  @Expose({ groups: ['search', 'create'] })
  @Column('int', { nullable: true })
  @IsNumber()
  minutesActive: number | null

  @Expose({ groups: ['search', 'create'] })
  @Column('int', { nullable: false })
  @IsNumber()
  mouseKeys: number | null

  @Expose({ groups: ['search', 'create'] })
  @Column('float', { nullable: false })
  @IsNumber()
  mouseDistance: number | null

  @Expose({ groups: ['search', 'create'] })
  @Column('timestamptz', { nullable: false })
  @IsDate()
  fromAt: Date

  @Expose({ groups: ['search', 'create'] })
  @Column('timestamptz', { nullable: false })
  @IsDate()
  toAt: Date
}
