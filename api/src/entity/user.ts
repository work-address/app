import { Entity, Column, OneToMany } from 'typeorm'
import { faker } from '@faker-js/faker'
import { JSONSchema } from 'class-validator-jsonschema'
import { Exclude, Expose } from 'class-transformer'

import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Validate,
} from 'class-validator'
import { AbstractBaseEntity } from '@/entity/abstract-base-entity'
import { PhoneConstraint } from '@/entity/constraint/phone-constraint'
import { EmailConstraint } from '@/entity/constraint/email-constraint'
import { EUserRole } from '@/model/user'
import { IUser } from '@/model/user'
import { Project } from '@/entity/project'
import { AccountAddress } from '@/service/account-address'

// TODO: add profile visibility flag, so user can hide their profile from the public
@JSONSchema({
  example: {
    id: faker.string.uuid(),
  },
})
@Entity()
@Exclude()
export class User extends AbstractBaseEntity implements IUser {
  @Column('jsonb', { default: () => "'[]'::jsonb" })
  agents: import('@/model/agent').WorkerAgent[]

  // Private settings are returned only by the authenticated /user/settings route.
  @Column('jsonb', { default: () => "'[]'::jsonb" })
  personalRedactionRules: import('@/model/dto/user-settings').RedactionRuleDto[]

  // An EVM address for a wallet account, the Google email for a Google account.
  @Expose({ groups: ['search', 'register'] })
  @Column('text', { unique: true })
  @IsString()
  @IsOptional()
  address: string

  // What sign-in matches for a Google account, because a mailbox can change
  // hands. Never returned.
  @Column('text', { nullable: true, unique: true })
  googleSub?: string | null

  // A Google account's proven wallet, set only by ConnectedWallet: shown on the
  // profile and paid on invoices. It signs nobody in and grants no access.
  @Expose({ groups: ['search'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  @JSONSchema(() => ({ type: 'string', nullable: true }))
  connectedWallet?: string | null

  // Unconfirmed, and so neither unique nor anything sign-in may read.
  @Expose({ groups: ['search', 'edit'] })
  @Validate(EmailConstraint, [], {
    groups: ['search', 'edit'],
  })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  @IsOptional({ groups: ['edit'] })
  @JSONSchema(() => ({ type: 'string', nullable: true }))
  email: string | null

  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @Validate(PhoneConstraint, [], {
    groups: ['search', 'edit'],
  })
  @IsOptional({ groups: ['edit'] })
  @IsString()
  @IsOptional()
  phone: string

  // Professional Information
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  name: string
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  title: string
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  company: string
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  bio: string
  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('decimal', { precision: 6, scale: 2, default: 0, nullable: true })
  @IsString()
  @IsOptional()
  rate: number
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  skills: string

  // Social
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  facebook: string
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  linkedIn: string
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  twitter: string
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  instagram: string
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  youtube: string
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  telegram: string
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  whatsapp: string

  // Location
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  tz: string
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  city: string

  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  country: string

  @OneToMany(() => Project, (project) => project.user)
  projects: Project[]
  @Expose({ groups: ['me'] })
  @Column('text', { array: true })
  @IsArray()
  @IsEnum(EUserRole, { each: true })
  @IsOptional()
  roles: EUserRole[] = []

  // Not exposed to the 'edit' group - premium is granted by billing, not
  // self-editable via PUT /user.
  @Expose({ groups: ['me'] })
  @Column('bool', { nullable: true, default: false })
  @IsBoolean()
  @IsOptional()
  premium?: boolean | null

  /** Where an invoice from this account is paid, if anywhere. */
  @Expose({ groups: ['search'] })
  @IsString()
  @IsOptional()
  @JSONSchema(() => ({ type: 'string', nullable: true, readOnly: true }))
  get payWallet(): string | null {
    return (
      this.connectedWallet ??
      (AccountAddress.isEvm(this.address ?? '') ? this.address : null)
    )
  }

  /** Where mail for this account goes: a Google email is proven, `email` isn't. */
  @Expose({ groups: ['me'] })
  @IsString()
  @IsOptional()
  @JSONSchema(() => ({ type: 'string', nullable: true, readOnly: true }))
  get contactEmail(): string | null {
    return AccountAddress.isEmail(this.address ?? '')
      ? this.address
      : (this.email ?? null)
  }
}
