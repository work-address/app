import {Column, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne} from 'typeorm';
import faker from 'faker';
import {Exclude, Expose, Type} from 'class-transformer';
import {JSONSchema} from 'class-validator-jsonschema';

import {User} from './User';
import {AbstractBaseEntity} from './AbstractBaseEntity';
import {EActivityType} from '../interface/EActivityType';
import {IsBoolean, IsNotEmpty, IsOptional, IsString} from 'class-validator';
import {EActivityState} from '../interface/EActivityState';
import {Proposal} from './Proposal';
import {Invoice} from './Invoice';
import {Time} from './Time';
import {IActivity} from '../interface/IActivity';

@JSONSchema({
  example: {
    id: faker.datatype.uuid(),
  },
})
@Entity()
@Exclude()
export class Activity extends AbstractBaseEntity implements IActivity {
  @IsNotEmpty()
  @Expose({groups: ['search', 'create', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  title: string;

  @Expose({groups: ['search', 'create', 'edit']})
  @Column('bool', {nullable: true, default: false})
  @IsBoolean()
  @IsOptional()
  trackScreenshots?: boolean | null;

  @Expose({groups: ['search', 'create', 'edit']})
  @Column('bool', {nullable: true, default: false})
  @IsBoolean()
  @IsOptional()
  trackProcesses?: boolean | null;

  @IsNotEmpty()
  @Expose({groups: ['search', 'create', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  text: any;

  @Expose({groups: ['search', 'create']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  location: string;

  @Expose({groups: ['search', 'create']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  position: string;

  @Expose({groups: ['search', 'create']})
  @Column('jsonb', {nullable: true})
  employment: string[];

  @Expose({groups: ['search', 'create', 'edit']})
  @Column('jsonb', {nullable: true})
  keywords: string[];

  @Expose({groups: ['search', 'create', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  salary: string;

  @Expose({groups: ['search', 'create', 'edit']})
  @Column('decimal', {precision: 6, scale: 2, default: 0, nullable: true})
  @IsString()
  @IsOptional()
  rateHour: number;

  @Expose({groups: ['search']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  sourceUrl: string;

  @Expose({groups: ['search']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  jobUrl: string;

  @Expose({groups: ['search']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  hash: string;

  @IsNotEmpty()
  @Expose({groups: ['search', 'create', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  type: EActivityType;

  @IsNotEmpty()
  @Expose({groups: ['search', 'create', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  state: EActivityState;

  @Expose({groups: ['search']})
  @Column('timestamptz', {nullable: true})
  processedAt: Date;
  @Expose({groups: ['search']})
  @Column('timestamptz', {nullable: true})
  cancelledAt: Date;
  @Expose({groups: ['search']})
  @Column('timestamptz', {nullable: true})
  startedAt: Date;
  @Expose({groups: ['search']})
  @Column('timestamptz', {nullable: true})
  closedAt: Date;

  @Expose({groups: ['search']})
  @Type(() => User)
  @ManyToOne(() => User, {eager: true, nullable: true})
  user: User;

  @Expose({groups: ['search']})
  @Type(() => Proposal)
  @OneToMany(() => Proposal, proposal => proposal.activity)
  proposals: Proposal[];

  @Expose({groups: ['search']})
  @Type(() => Invoice)
  @OneToMany(() => Invoice, invoice => invoice.activity)
  invoices: Invoice[];
  @Expose({groups: ['search']})
  @Type(() => Time)
  @OneToMany(() => Time, time => time.activity)
  time: Time[];

  @Expose({groups: ['search']})
  @Type(() => Proposal)
  @OneToOne(() => Proposal, proposal => proposal.activity)
  @JoinColumn()
  proposalAccepted: Proposal | null;
}
