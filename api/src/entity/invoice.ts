import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm'
import { faker } from '@faker-js/faker'
import { Exclude, Expose, Type } from 'class-transformer'
import { JSONSchema } from 'class-validator-jsonschema'

import { AbstractBaseEntity } from '@/entity/abstract-base-entity'
import { Project } from '@/entity/project'
import { IsDate, IsNotEmpty } from 'class-validator'
import { EInvoiceState } from '@/model/invoice'

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

  @Expose({ groups: ['search'] })
  @Column('timestamptz')
  @IsDate()
  fromAt: Date
  @Expose({ groups: ['search'] })
  @Column('timestamptz')
  @IsDate()
  toAt: Date

  @IsNotEmpty()
  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('float', { nullable: false })
  amount: number
  @IsNotEmpty()
  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('text', { nullable: true })
  state: EInvoiceState
}
