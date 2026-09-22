import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm'
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
  IsUUID,
} from 'class-validator'
import {
  EInvoiceBasis,
  EInvoiceCurrency,
  EInvoiceEscrowState,
  EInvoiceIssuanceKind,
  EInvoiceSettlementKind,
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
// unique index does not compare. Being global, it would let anyone squat an
// allocation, so InvoiceManager binds one only to an invoice its own
// contract's hired worker issued, for the allocation that contract derives.
@Index(
  'UQ_invoice_escrow_allocation',
  ['escrowChainId', 'escrowAddress', 'escrowAllocationId'],
  { unique: true },
)
// A cadence period takes one invoice per issuer, and the database is what
// makes that true: a scheduler run that overlaps another, or one that is
// simply run twice, inserts the second row and Postgres refuses it. Manual
// invoices carry no period, and a unique constraint does not compare rows
// with nulls in it, so they are all distinct from each other and from every
// scheduled one - which is exactly the policy: pressing the button is always
// allowed, and never collides with the schedule.
@Unique('UQ_INVOICE_SCHEDULED_PERIOD', [
  'project',
  'user',
  'periodStart',
  'periodEnd',
  'issuanceKind',
])
// A marketplace milestone is billed once. The reference is the marketplace's
// own id for the agreed piece of work, so it is unique across this instance
// and the index is global, exactly like the escrow allocation's above: a
// retried push, or two pushes racing, insert the second row and Postgres
// refuses it. Every invoice that is not a milestone carries null here, and a
// unique index does not compare nulls, so they are all distinct from each
// other and from every milestone invoice. Squatting is not a risk the way it
// is for an allocation id: only the signed internal route ever writes this
// column, and a person cannot reach it.
@Index('UQ_invoice_milestone_ref', ['milestoneRef'], { unique: true })
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

  /*
   * How this invoice came to exist, and - when the schedule raised it - which
   * cadence period it bills.
   *
   * `fromAt`/`toAt` above span the entries actually billed, which is not the
   * period: a week in which somebody worked one afternoon has a one-afternoon
   * span and a full week's period. The period is what the schedule promised
   * to bill once, so it is what the unique key above is drawn on.
   *
   * All null on a manual invoice, and on every invoice issued before the
   * schedule existed. Written once with the rest of the snapshot and never
   * moved: an invoice cannot be reassigned to another period.
   */

  @Expose({ groups: ['search'] })
  @Column({ type: 'text', nullable: true, update: false })
  @IsEnum(EInvoiceIssuanceKind)
  @IsOptional()
  issuanceKind?: EInvoiceIssuanceKind | null

  /** The cutoff that opened the period, exactly as the cadence computed it. */
  @Expose({ groups: ['search'] })
  @Column({ type: 'timestamptz', nullable: true, update: false })
  @IsDate()
  @IsOptional()
  periodStart?: Date | null

  /** The cutoff that closed it. */
  @Expose({ groups: ['search'] })
  @Column({ type: 'timestamptz', nullable: true, update: false })
  @IsDate()
  @IsOptional()
  periodEnd?: Date | null

  /**
   * What this invoice charges for: tracked hours at a rate, or an agreed sum
   * (`EInvoiceBasis`).
   *
   * Not null, and defaulted rather than backfilled: every invoice that
   * existed before this column did bills tracked hours, so the column's own
   * `DEFAULT 'HOURLY'` is the whole migration and no row is left undecided.
   * Written once with the rest of the snapshot - what an invoice bills on is
   * not something a later edit may change.
   */
  @Expose({ groups: ['search'] })
  @Column({
    type: 'text',
    nullable: false,
    default: EInvoiceBasis.HOURLY,
    update: false,
  })
  @IsEnum(EInvoiceBasis)
  basis: EInvoiceBasis

  /**
   * The marketplace milestone this invoice bills, as the marketplace names
   * it. Null on every invoice that is not a milestone bill, which is what
   * keeps the unique index above from comparing them.
   *
   * Written once: moving a bill to another milestone would let one agreed sum
   * be billed twice.
   */
  @Expose({ groups: ['search'] })
  @Column({ type: 'text', nullable: true, update: false })
  @IsString()
  @IsOptional()
  milestoneRef?: string | null

  /**
   * What the invoice is billing for, in the words the parties agreed.
   *
   * An hourly invoice answers that with its lines - the entries, their spans
   * and their notes. A FIXED one has no lines, so without this it would be a
   * sum with nothing behind it: required at issuance for that basis, and part
   * of the snapshot, so the deliverable being renamed afterwards does not
   * rewrite what was billed.
   */
  @Expose({ groups: ['search'] })
  @Column({ type: 'text', nullable: true, update: false })
  @IsString()
  @IsOptional()
  description?: string | null

  /**
   * The invoice this one corrects, when it is an adjustment (DEC-04).
   *
   * An issued invoice is never edited: its snapshot is the record of what
   * was billed, and an entry it bills cannot be deleted (409). A correction
   * is therefore a new invoice that names the one it corrects and bills only
   * what that one did not - hours that came in late, or were left off. The
   * original is never written to, so whatever it was paid or refunded stays
   * exactly as it was. Null on every invoice that corrects nothing.
   *
   * Written once. A foreign key to `invoice`, so the reference always
   * resolves; a column rather than an entity of its own, because what an
   * invoice corrects is part of the invoice (SPEC.md, "No new domains").
   */
  @Expose({ groups: ['search'] })
  @Column({ type: 'uuid', nullable: true, update: false })
  @IsUUID()
  @IsOptional()
  correctsInvoiceId?: string | null

  @ManyToOne(() => Invoice, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'correctsInvoiceId' })
  corrects?: Invoice | null

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
   * When the invoice was paid: when the issuer recorded payment, or - for an
   * invoice settled through escrow - the time of the block that released it.
   * Set alongside the PAID state and cleared when a hand mark is reverted, so
   * a mistaken mark leaves no stale timestamp.
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
   * How the invoice was settled: MANUAL when its issuer marked it paid,
   * ESCROW once a confirmed escrow outcome was recorded on it (paid by a
   * release, or refunded). Null while unsettled - and on invoices marked paid
   * before the kind was recorded, which were all manual.
   */
  @Expose({ groups: ['search'] })
  @Column('text', { nullable: true })
  @IsEnum(EInvoiceSettlementKind)
  @IsOptional()
  settlementKind?: EInvoiceSettlementKind | null

  /*
   * The confirmed outcome of the bound allocation, as the marketplace's escrow
   * indexer pushes it (POST /api/internal/marketplace/settlement): its state
   * and totals, in token base units. Written only by that push, never by a
   * person, and only forward - a push older than what is recorded changes
   * nothing. The one way back is the chain's: a settlement a reorganisation
   * took off the chain is cleared again by its reversal
   * (POST /api/internal/marketplace/settlement-reversal). Columns rather
   * than an entity, for the same reason as the binding: how the invoice was
   * settled is part of the invoice.
   */

  @Expose({ groups: ['search'] })
  @Column('text', { nullable: true })
  @IsEnum(EInvoiceEscrowState)
  @IsOptional()
  escrowState?: EInvoiceEscrowState | null

  /** What the bill put on chain. */
  @Expose({ groups: ['search'] })
  @Column('numeric', { precision: 78, scale: 0, nullable: true })
  @IsString()
  @IsOptional()
  escrowGrossBaseUnits?: string | null

  /** The platform fee release paid (5% of gross); 0 unless released. */
  @Expose({ groups: ['search'] })
  @Column('numeric', { precision: 78, scale: 0, nullable: true })
  @IsString()
  @IsOptional()
  escrowFeeBaseUnits?: string | null

  /** What release paid the payee (gross less the fee); 0 unless released. */
  @Expose({ groups: ['search'] })
  @Column('numeric', { precision: 78, scale: 0, nullable: true })
  @IsString()
  @IsOptional()
  escrowNetBaseUnits?: string | null

  /** Everything the allocation returned to the payer. */
  @Expose({ groups: ['search'] })
  @Column('numeric', { precision: 78, scale: 0, nullable: true })
  @IsString()
  @IsOptional()
  escrowRefundedBaseUnits?: string | null

  /** The settling transaction: release, dispute, expiry or cancellation. */
  @Expose({ groups: ['search'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  escrowTxHash?: string | null

  /** The settling block's time. A release sets `paidAt` to it. */
  @Expose({ groups: ['search'] })
  @Column('timestamptz', { nullable: true })
  @IsDate()
  @IsOptional()
  escrowConfirmedAt?: Date | null

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
