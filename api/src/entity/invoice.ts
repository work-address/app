import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm'
import { faker } from '@faker-js/faker'
import { Exclude, Expose, Type } from 'class-transformer'
import { JSONSchema } from 'class-validator-jsonschema'

import { AbstractBaseEntity } from '@/entity/abstract-base-entity'
import { Project } from '@/entity/project'
import { User } from '@/entity/user'
import { IsDate, IsInt, IsNotEmpty, IsOptional } from 'class-validator'
import { EInvoiceState, IInvoiceReport } from '@/model/invoice'

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
   */
  @IsNotEmpty()
  @IsInt()
  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('integer', { nullable: false, default: 0 })
  amountCents: number
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
