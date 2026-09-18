import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm'
import { faker } from '@faker-js/faker'
import { Exclude, Expose, Type } from 'class-transformer'
import { JSONSchema } from 'class-validator-jsonschema'

import { AbstractBaseEntity } from '@/entity/abstract-base-entity'
import { Project } from '@/entity/project'
import { User } from '@/entity/user'
import {
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator'
import {
  EInvoiceCurrency,
  EInvoiceSnapshotVersion,
  EInvoiceState,
  IInvoiceLine,
  IInvoiceReport,
} from '@/model/invoice'

// Type-only: `Time` imports `Invoice` for its own relation, and a value import
// here would close that cycle at runtime.
import type { Time } from '@/entity/time'

@JSONSchema({
  example: {
    id: faker.string.uuid(),
  },
})
@Entity()
@Exclude()
export class Invoice extends AbstractBaseEntity {
  @Expose({ groups: ['search'] })
  @Type(() => Project)
  @ManyToOne(() => Project, { eager: true, nullable: false })
  @JoinColumn({ name: 'projectId' })
  project: Project

  /**
   * Who issued this invoice - the worker billing for their own hours, or the
   * project owner billing for theirs.
   *
   * Nullable only so existing rows survive a schema sync; every invoice
   * created from now on has one. Before this field the issuer was implicitly
   * the project owner, which is why access was owner-only everywhere.
   */
  @Expose({ groups: ['search'] })
  @Type(() => User)
  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User | null

  @Expose({ groups: ['search'] })
  @Column('timestamptz')
  @IsDate()
  fromAt: Date
  @Expose({ groups: ['search'] })
  @Column('timestamptz')
  @IsDate()
  toAt: Date

  /**
   * Whole cents, never dollars.
   *
   * A float column cannot represent every cent exactly, so summing invoices
   * drifted and two clients could render the same row differently. Integers
   * are exact; the conversion to a display string happens at the edge.
   *
   * Written once, with the snapshot below, and never updated: `update: false`
   * makes the ORM leave it out of every later save, so no code path can
   * change what was billed.
   */
  @IsNotEmpty()
  @IsInt()
  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column({ type: 'integer', nullable: false, default: 0, update: false })
  amountCents: number

  /*
   * The financial snapshot (DEC-04): what the amount was computed from,
   * frozen in the same write as `amountCents`. Later edits to the project
   * rate, to the entries' activity, or to their screenshots and processes
   * change none of it. Columns rather than a separate entity - an invoice's
   * breakdown is part of the invoice (SPEC.md, "No new domains").
   *
   * All nullable only so invoices issued before the snapshot survive a
   * schema sync; every invoice issued since has every field. All but the
   * version are `update: false`, for the same reason as `amountCents`.
   */

  /**
   * `1` for an invoice carrying the v1 snapshot, `0` for one the backfill
   * marked legacy, null for one issued before snapshots and not yet
   * backfilled. Updatable only so the backfill can mark legacy rows.
   */
  @Expose({ groups: ['search'] })
  @Column('integer', { nullable: true })
  @IsEnum(EInvoiceSnapshotVersion)
  @IsOptional()
  snapshotVersion?: EInvoiceSnapshotVersion | null

  /** The issuer's wallet address at issuance, in canonical form. */
  @Expose({ groups: ['search'] })
  @Column({ type: 'text', nullable: true, update: false })
  @IsString()
  @IsOptional()
  issuerAddress?: string | null

  /**
   * The counterparty: the project owner's wallet address at issuance, in
   * canonical form.
   */
  @Expose({ groups: ['search'] })
  @Column({ type: 'text', nullable: true, update: false })
  @IsString()
  @IsOptional()
  ownerAddress?: string | null

  @Expose({ groups: ['search'] })
  @Column({ type: 'text', nullable: true, update: false })
  @IsEnum(EInvoiceCurrency)
  @IsOptional()
  currency?: EInvoiceCurrency | null

  /** The project's hourly rate when the invoice was issued, in whole cents. */
  @Expose({ groups: ['search'] })
  @Column({ type: 'integer', nullable: true, update: false })
  @IsInt()
  @IsOptional()
  rateHourCents?: number | null

  /** Active minutes billed: the sum over `lines`. */
  @Expose({ groups: ['search'] })
  @Column({ type: 'integer', nullable: true, update: false })
  @IsInt()
  @IsOptional()
  minutesActive?: number | null

  /**
   * The billed entries as they stood at issuance, ordered by start then id.
   *
   * In the single-read group only, like `time`: the invoice list does not
   * need every line of every invoice on it.
   */
  @Expose({ groups: ['invoiceRead'] })
  @Column({ type: 'jsonb', nullable: true, update: false })
  @IsArray()
  @IsOptional()
  lines?: IInvoiceLine[] | null
  @IsNotEmpty()
  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('text', { nullable: true })
  state: EInvoiceState

  /**
   * When the issuer recorded payment. Set alongside the PAID state and cleared
   * when it is reverted, so a mistaken mark leaves no stale timestamp.
   */
  @Expose({ groups: ['search'] })
  @Column('timestamptz', { nullable: true })
  @IsDate()
  @IsOptional()
  paidAt?: Date | null

  /**
   * The entries this invoice bills, and their roll-up.
   *
   * Not columns - `InvoiceManager.read` fills them in from the `Time.invoice`
   * link so that opening an invoice is one request. They sit in their own
   * serialisation group rather than in `search`, so the invoice *list* is not
   * forced to carry every line item of every invoice on it.
   */
  @Expose({ groups: ['invoiceRead'] })
  time?: Time[]

  @Expose({ groups: ['invoiceRead'] })
  report?: IInvoiceReport
}
