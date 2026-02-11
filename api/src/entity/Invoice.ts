import {Column, Entity, ManyToOne} from 'typeorm';
import faker from 'faker';
import {Exclude, Expose, Type} from 'class-transformer';
import {JSONSchema} from 'class-validator-jsonschema';

import {AbstractBaseEntity} from './AbstractBaseEntity';
import {Activity} from './Activity';
import {IsDate, IsNotEmpty, IsOptional} from 'class-validator';
import {EInvoiceState} from '../interface/EInvoiceState';

@JSONSchema({
  example: {
    id: faker.datatype.uuid(),
  },
})
@Entity()
@Exclude()
export class Invoice extends AbstractBaseEntity {
  @Expose({groups: ['search']})
  @Type(() => Activity)
  @ManyToOne(() => Activity, {eager: true, nullable: false})
  activity: Activity;

  @Expose({groups: ['search']})
  @Column('timestamptz')
  @IsDate()
  fromAt: Date;
  @Expose({groups: ['search']})
  @Column('timestamptz')
  @IsDate()
  toAt: Date;

  @IsNotEmpty()
  @Expose({groups: ['search', 'create', 'edit']})
  @Column('float', {nullable: false})
  amount: number;
  @IsOptional()
  @Expose({groups: ['search', 'create', 'edit']})
  @Column('text', {nullable: true})
  paymentTxId: string;
  @IsNotEmpty()
  @Expose({groups: ['search', 'create', 'edit']})
  @Column('text', {nullable: true})
  state: EInvoiceState;
}
