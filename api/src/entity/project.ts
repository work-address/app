import { Column, Entity, ManyToOne, OneToMany } from 'typeorm'
import { faker } from '@faker-js/faker'
import { Exclude, Expose, Type } from 'class-transformer'
import { JSONSchema } from 'class-validator-jsonschema'

import { User } from '@/entity/user'
import { AbstractBaseEntity } from '@/entity/abstract-base-entity'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'
import { EProjectState } from '@/model/project'
import { Invoice } from '@/entity/invoice'
import { ProjectStatistics } from '@/entity/project-statistics'
import { Time } from '@/entity/time'
import { IProject } from '@/model/project'

// Access lists are unnested on every access check, so they stay bounded.
// Addresses are free-form strings (a wallet may not have an account yet),
// which is exactly why they need a ceiling. Module scope, not static fields:
// decorator arguments are evaluated before static initializers run.
export const MAX_COLLABORATORS = 100
export const MAX_ADDRESS_LENGTH = 128

@JSONSchema({
  example: {
    id: faker.string.uuid(),
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
  @ArrayMaxSize(MAX_COLLABORATORS)
  @IsString({ each: true })
  @MaxLength(MAX_ADDRESS_LENGTH, { each: true })
  @IsOptional()
  workerAddresses: string[]
  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('text', { array: true, nullable: true })
  @IsArray()
  @ArrayMaxSize(MAX_COLLABORATORS)
  @IsString({ each: true })
  @MaxLength(MAX_ADDRESS_LENGTH, { each: true })
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
      this.isOwner(user) || this.hasCollaborator(this.workerAddresses, user)
    )
  }

  public isViewer(user: User): boolean {
    return (
      this.isWorker(user) || this.hasCollaborator(this.viewerAddresses, user)
    )
  }

  /**
   * Mirrors the SQL access filters in ProjectRepository: addresses match
   * case-insensitively, and collaborator access only counts while the owner
   * holds a premium plan. Kept in step with those filters deliberately - two
   * different answers to "who may see this project" is how access bugs start.
   */
  private hasCollaborator(
    addresses: string[] | undefined,
    user: User,
  ): boolean {
    if (!this.user?.premium) {
      return false
    }

    const target = user.address?.toLowerCase()

    return (addresses ?? []).some((address) => address.toLowerCase() === target)
  }

  public static accessParams(user: User) {
    return {
      accessUserId: user.id,
      userAddress: user.address.toLowerCase(),
    }
  }
}
