import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  RelationId,
  Unique,
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
  IsArray,
  IsBoolean,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator'

@JSONSchema({
  example: {
    id: faker.string.uuid(),
  },
})
@Entity()
@Exclude()
@Unique('UQ_PROJECT_FROM_AT', ['project', 'fromAt'])
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
   * The relation itself stays outside every serialisation group: exposing it
   * would let a client round-trip it back on an edit and move hours between
   * invoices. `invoiceId` below is the read-only view of it.
   */
  @ManyToOne(() => Invoice, { nullable: true, onDelete: 'SET NULL' })
  invoice?: Invoice | null

  /**
   * The id of the invoice that bills this entry, or null - read-only.
   *
   * A client needs it to know the entry's payment is the invoice's to change,
   * and to point there. It is safe to serialise where the relation above is
   * not: a `@RelationId` is derived on read and never written back, so a
   * client round-tripping it on an edit still cannot move hours between
   * invoices.
   */
  @Expose({ groups: ['search'] })
  @RelationId((time: Time) => time.invoice)
  @IsUUID()
  @IsOptional()
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

  @Expose({ groups: ['search', 'create'] })
  @Column('int', { nullable: false })
  @IsNumber()
  keyboardKeys: number

  @Expose({ groups: ['search', 'create'] })
  @Column('int', { nullable: true })
  @IsNumber()
  minutesActive: number

  @Expose({ groups: ['search', 'create'] })
  @Column('int', { nullable: false })
  @IsNumber()
  mouseKeys: number

  @Expose({ groups: ['search', 'create'] })
  @Column('float', { nullable: false })
  @IsNumber()
  mouseDistance: number

  @Expose({ groups: ['search', 'create'] })
  @Column('timestamptz', { nullable: false })
  @IsDate()
  fromAt: Date

  @Expose({ groups: ['search', 'create'] })
  @Column('timestamptz', { nullable: false })
  @IsDate()
  toAt: Date

  public isAuthor(user: User): boolean {
    return this.user?.id === user.id
  }
}
