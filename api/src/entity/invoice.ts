import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm'
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
// An escrow allocation takes one bill (MarketplaceEscrow moves it from Funded
// to Submitted once), so it bills one invoice. The index is what makes that
// hold when two submissions race; rows never submitted are all null, which a
// unique index does not compare.
@Index(
  'UQ_invoice_escrow_allocation',
  ['escrowChainId', 'escrowAddress', 'escrowAllocationId'],
  { unique: true },
)
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

  /*
   * The escrow allocation the invoice was submitted to (GET
   * /invoice/:id/escrow-submission), and the commitment it was submitted
   * under. Written once, on the first submission, and never moved: the
   * escrow cannot say whether a commitment it was handed was ever sent, so
   * letting the invoice go to a second allocation could bill it twice.
   *
   * All null for an invoice never submitted. Columns rather than an entity -
   * which allocation an invoice was billed through is part of the invoice
   * (SPEC.md, "No new domains").
   */

  @Expose({ groups: ['search'] })
  @Column('integer', { nullable: true })
  @IsInt()
  @IsOptional()
  escrowChainId?: number | null

  /** The MarketplaceEscrow deployment, lowercase. */
  @Expose({ groups: ['search'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  escrowAddress?: string | null

  /** The allocation's bytes32 id, lowercase 0x hex. */
  @Expose({ groups: ['search'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  escrowAllocationId?: string | null

  /**
   * InvoiceCommitment v1 of this invoice's record, for this allocation, under
   * `escrowSalt`: the bytes32 the chain holds for the bill. Shown to both
   * parties - it reveals nothing without the salt.
   */
  @Expose({ groups: ['search'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  escrowCommitment?: string | null

  /**
   * The 32 random bytes the commitment was drawn under. In no serialisation
   * group, so no invoice response carries it: only the issuer's own
   * escrow-submission response does. Held here so the hosted service can
   * hand the issuer the same submission again - which means the operator of
   * this service can open the commitment, while a chain observer cannot
   * (SPEC.md, "Salt custody"). No validators either, which keeps it out of
   * the published Invoice schema: it is never input, and never output.
   */
  @Column('text', { nullable: true })
  escrowSalt?: string | null

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
