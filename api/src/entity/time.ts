import {Column, Entity, JoinColumn, ManyToOne, Unique} from 'typeorm';
import faker from 'faker';
import {Exclude, Expose, Type} from 'class-transformer';
import {JSONSchema} from 'class-validator-jsonschema';

import {AbstractBaseEntity} from './abstract-base-entity';
import {Project} from './project';
import {ITime} from '../interface/time';
import {IsArray, IsDate, IsNumber, IsOptional, IsString} from 'class-validator';

@JSONSchema({
  example: {
    id: faker.datatype.uuid(),
  },
})
@Entity()
@Exclude()
@Unique('UQ_PROJECT_FROM_AT', ['project', 'fromAt'])
export class Time extends AbstractBaseEntity implements ITime {
  @Expose({groups: ['search']})
  @Type(() => Project)
  @ManyToOne(() => Project, {eager: true, nullable: false})
  @JoinColumn({name: 'projectId'})
  project: Project;

  @Expose({groups: ['search', 'create', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  note: string | null;

  @Expose({groups: ['search', 'create', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  screenshot: string | null;

  @Expose({groups: ['search', 'create', 'edit']})
  @Column('jsonb', {nullable: true})
  @IsArray()
  @IsOptional()
  processes: ITime['processes'];

  @Expose({groups: ['search', 'create', 'edit']})
  @Column('int', {nullable: false})
  @IsNumber()
  keyboardKeys: number;

  @Expose({groups: ['search', 'create', 'edit']})
  @Column('int', {nullable: true})
  @IsNumber()
  minutesActive: number;

  @Expose({groups: ['search', 'create', 'edit']})
  @Column('int', {nullable: false})
  @IsNumber()
  mouseKeys: number;

  @Expose({groups: ['search', 'create', 'edit']})
  @Column('float', {nullable: false})
  @IsNumber()
  mouseDistance: number;

  @Expose({groups: ['search', 'create', 'edit']})
  @Column('timestamptz', {nullable: false})
  @IsDate()
  fromAt: Date;

  @Expose({groups: ['search', 'create', 'edit']})
  @Column('timestamptz', {nullable: false})
  @IsDate()
  toAt: Date;
}
