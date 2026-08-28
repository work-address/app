import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm'
import { faker } from '@faker-js/faker'
import { Exclude, Expose, Type } from 'class-transformer'
import { JSONSchema } from 'class-validator-jsonschema'

import { AbstractBaseEntity } from '@/entity/abstract-base-entity'
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
