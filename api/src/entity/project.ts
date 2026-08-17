import { Column, Entity, ManyToOne, OneToMany } from 'typeorm'
import faker from 'faker'
import { Exclude, Expose, Type } from 'class-transformer'
import { JSONSchema } from 'class-validator-jsonschema'

import { User } from '@/entity/user'
import { AbstractBaseEntity } from '@/entity/abstract-base-entity'
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator'
import { EProjectState } from '@/model/project'
import { Invoice } from '@/entity/invoice'
import { ProjectStatistics } from '@/entity/project-statistics'
import { Time } from '@/entity/time'
import { IProject } from '@/model/project'

@JSONSchema({
  example: {
    id: faker.datatype.uuid(),
  },
})
@Entity('project')
@Exclude()
export class Project extends AbstractBaseEntity implements IProject {
  @IsNotEmpty()
  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  title: string

  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('text', { array: true, nullable: true })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  workerAddresses: string[]
  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('text', { array: true, nullable: true })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  viewerAddresses: string[]

  @Expose({ groups: ['search'] })
  @Type(() => User)
  @IsArray()
  @IsOptional()
  workers: User[]
  @Expose({ groups: ['search'] })
  @Type(() => User)
  @IsArray()
  @IsOptional()
  viewers: User[]

  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('bool', { nullable: true, default: false })
  @IsBoolean()
  @IsOptional()
  trackScreenshots?: boolean | null

  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('bool', { nullable: true, default: false })
  @IsBoolean()
  @IsOptional()
  trackProcesses?: boolean | null

  @IsNotEmpty()
  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  text: string

  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('decimal', { precision: 6, scale: 2, default: 0, nullable: true })
  @IsString()
  @IsOptional()
  rateHour: number

  @IsNotEmpty()
  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  state: EProjectState

  @Expose({ groups: ['search'] })
  @Type(() => User)
  @ManyToOne(() => User, { eager: true, nullable: true })
  user: User

  @Expose({ groups: ['search'] })
  @Type(() => Invoice)
  @OneToMany(() => Invoice, (invoice) => invoice.project)
  invoices: Invoice[]
  @Expose({ groups: ['search'] })
  @Type(() => Time)
  @OneToMany(() => Time, (time) => time.project)
  time: Time[]

  // @Expose({ groups: ['search'] })
  @Type(() => ProjectStatistics)
  @OneToMany(() => ProjectStatistics, (statistics) => statistics.project)
  statistics: ProjectStatistics[]

  public isOwner(user: User): boolean {
    return this.user?.id === user.id
  }

  public isWorker(user: User): boolean {
    return (
      this.isOwner(user) || (this.workerAddresses ?? []).includes(user.address)
    )
  }

  public isViewer(user: User): boolean {
    return (
      this.isWorker(user) || (this.viewerAddresses ?? []).includes(user.address)
    )
  }

  public static accessParams(user: User) {
    return {
      accessUserId: user.id,
      userAddress: user.address.toLowerCase(),
    }
  }
}
