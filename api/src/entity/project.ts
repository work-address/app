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
  IsInt,
  Min,
  Max,
} from 'class-validator'
import { EProjectState } from '@/model/project'
import { Invoice } from '@/entity/invoice'
import { ProjectStatistics } from '@/entity/project-statistics'
import { Time } from '@/entity/time'
import { IProject } from '@/model/project'
import type { ProjectRole } from '@/service/project-access'

// Access lists are unnested on every access check, so they stay bounded.
// An address may not have an account yet, which is why they need a ceiling.
// 254 is the longest an email can be. Module scope, not static fields:
// decorator arguments are evaluated before static initializers run.
export const MAX_COLLABORATORS = 100
export const MAX_ADDRESS_LENGTH = 254

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

  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('bool', { default: false })
  @IsBoolean()
  @IsOptional()
  trackAgents: boolean

  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('bool', { default: false })
  @IsBoolean()
  @IsOptional()
  trackWindowTitles: boolean

  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('bool', { default: false })
  @IsBoolean()
  @IsOptional()
  trackBrowserDomains: boolean

  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('bool', { default: false })
  @IsBoolean()
  @IsOptional()
  allowManualTime: boolean

  /**
   * Whether a contributor may track this project from the phone app. Off by
   * default and the owner's alone, like the recording switches: phone time
   * carries none of the detail a desktop project may have asked for.
   */
  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('bool', { default: false })
  @IsBoolean()
  @IsOptional()
  allowMobileTime: boolean

  /**
   * When `allowMobileTime` last went from on to off. A phone entry that started
   * before it was recorded under the owner's setting and is still accepted.
   * Only the last switch is kept. Set by the server, never by an edit.
   */
  @Column('timestamptz', { nullable: true })
  mobileTimeOffAt: Date | null

  /**
   * Whether the phone app records where the phone was while its timer runs.
   * Always equal to `allowMobileTime`: phone tracking records location, and
   * the server sets this on every save, whatever the client sends. Kept so the
   * tracker's project list is unchanged. Points sent while it is off are not
   * stored.
   */
  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('bool', { default: false })
  @IsBoolean()
  @IsOptional()
  trackLocation: boolean

  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('int', { default: 24 })
  @IsInt()
  @Min(1)
  @Max(24)
  @IsOptional()
  reviewWindowHours: number

  @Expose({ groups: ['search', 'create', 'edit'] })
  @JSONSchema({ type: 'integer', nullable: true })
  @Column('int', { nullable: true })
  @IsInt()
  @Min(1)
  @Max(3650)
  @IsOptional()
  screenshotRetentionDays: number | null

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

  @Column('timestamptz', { nullable: true })
  agentTrackingSince: Date | null

  @Column('jsonb', { name: 'agents', default: () => "'[]'::jsonb" })
  agentAttachments: import('@/model/agent').AgentAttachment[]

  @Expose({ groups: ['search'] })
  @IsArray()
  @IsOptional()
  @JSONSchema({ type: 'array', items: { type: 'object' } })
  agents?: import('@/model/agent').AgentAttachment[]

  /** Set on search results: whether the caller's time uploads are accepted. */
  @Expose({ groups: ['search'] })
  @IsOptional()
  canTrack?: boolean

  /**
   * Set on reads: what the project's lists say the caller is. Unlike `canTrack`
   * it holds for a closed project too.
   */
  @Expose({ groups: ['search'] })
  @IsOptional()
  @JSONSchema({ type: 'string', enum: ['owner', 'worker', 'viewer'] })
  role?: ProjectRole | null

  public isOwner(user: User): boolean {
    return this.user?.id === user.id
  }
}
