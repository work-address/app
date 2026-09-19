import { Entity, Column, Index, OneToMany } from 'typeorm'
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
  ValidateIf,
} from 'class-validator'
import { AbstractBaseEntity } from '@/entity/abstract-base-entity'
import { PhoneConstraint } from '@/entity/constraint/phone-constraint'
import { EmailConstraint } from '@/entity/constraint/email-constraint'
import { EUserRole } from '@/model/user'
import { IUser } from '@/model/user'
import { Project } from '@/entity/project'

/**
 * Three read projections, from narrowest to broadest:
 *
 * - `public` - the anonymous profile (PRODUCT.md 4.7): the address and what
 *   is on the profile page, nothing else. No id, no timestamps.
 * - `search` - how one user appears to another: a /user/search row, and the
 *   owner, workers and viewers nested in a project, invoice or time entry.
 *   `public` plus the id and timestamps, which those clients match on.
 * - `me` - added on top of `search` only where the record is the caller's
 *   own (GET /auth/status): contact details, roles and the plan.
 *
 * A field that reaches a person, authorises them, or says what they pay for
 * belongs in `me` and never in `search`: `search` is serialized for other
 * people, because every nested user rides on it.
 */
@JSONSchema({
  example: {
    id: faker.string.uuid(),
  },
})
@Entity()
@Exclude()
export class User extends AbstractBaseEntity implements IUser {
  @Expose({ groups: ['public', 'search', 'register'] })
  @Column('text', { unique: true })
  @IsString()
  @IsOptional()
  address: string

  @Expose({ groups: ['me', 'edit'] })
  @Index({ unique: true })
  @Validate(EmailConstraint, [], {
    groups: ['search', 'edit'],
  })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  @IsOptional({ groups: ['edit'] })
  email: string

  @Expose({ groups: ['me', 'edit'] })
  @Column('text', { nullable: true })
  @Validate(PhoneConstraint, [], {
    groups: ['search', 'edit'],
  })
  @IsOptional({ groups: ['edit'] })
  @IsString()
  @IsOptional()
  @Index({ unique: true })
  phone: string

  // Professional Information
  @Expose({ groups: ['public', 'search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  name: string
  @Expose({ groups: ['public', 'search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  title: string
  @Expose({ groups: ['public', 'search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  company: string
  @Expose({ groups: ['public', 'search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  bio: string
  @Expose({ groups: ['public', 'search', 'create', 'edit'] })
  @Column('decimal', { precision: 6, scale: 2, default: 0, nullable: true })
  @IsString()
  @IsOptional()
  rate: number
  @Expose({ groups: ['public', 'search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  skills: string

  // Social
  @Expose({ groups: ['public', 'search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  facebook: string
  @Expose({ groups: ['public', 'search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  linkedIn: string
  @Expose({ groups: ['public', 'search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  twitter: string
  @Expose({ groups: ['public', 'search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  instagram: string
  @Expose({ groups: ['public', 'search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  youtube: string
  @Expose({ groups: ['public', 'search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  telegram: string
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  whatsapp: string

  // Location
  @Expose({ groups: ['public', 'search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  tz: string
  @Expose({ groups: ['public', 'search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  city: string

  @Expose({ groups: ['public', 'search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  country: string

  @OneToMany(() => Project, (project) => project.user)
  projects: Project[]
  @Expose({ groups: ['me', 'edit'] })
  @Column('text', { array: true })
  @IsArray()
  @IsEnum(EUserRole, { each: true })
  @IsOptional()
  roles: EUserRole[] = []

  // Not exposed to the 'edit' group - premium is granted by billing, not
  // self-editable via PUT /user. Only the holder reads it: it governs
  // retention, and is not a credential to show anyone else.
  @Expose({ groups: ['me'] })
  @Column('bool', { nullable: true, default: false })
  @IsBoolean()
  @IsOptional()
  premium?: boolean | null

  /**
   * Whether the profile is public. A hidden one answers 404 to everyone but
   * its holder at GET /user/:address/address, and is left out of other
   * people's /user/search. Only the holder reads or sets it: nobody else is
   * shown the profile, so nobody else is told it was hidden.
   *
   * It hides what this service serves, and nothing more. A profile published
   * to IdentityRegistry stays on chain, and stays current, until the holder
   * withdraws it there. Hiding is off-chain and undone by showing the profile
   * again; a withdrawal is a chain transaction, and every version published
   * before it stays readable (SC-A07).
   *
   * Absent from an edit leaves it as it is; null is refused, because the
   * column has no "unknown" state to store it as.
   */
  @Expose({ groups: ['me', 'edit'] })
  @Column('bool', { default: true })
  @ValidateIf((_user, value) => value !== undefined, { groups: ['edit'] })
  @IsBoolean({ groups: ['edit'] })
  visible: boolean
}
