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
import type { ProfileExport, ProfilePresentation } from '@/vendor/identity'

/**
 * Read and written only by UserRepository's hosted-identity methods. Spread
 * into each @Column, never passed as is: TypeORM writes the column's type
 * into the options object it is given, so one shared object would give every
 * identity column the type of the last one declared.
 */
const IDENTITY_COLUMN = {
  nullable: true,
  select: false,
  insert: false,
  update: false,
} as const

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
   * Whether hosted billing applies to this account's instance. Not a column:
   * the holder's own payload (`GET /auth/status`) sets it from Entitlement,
   * alongside an entitlement-aware `premium`, so a self-hosted instance -
   * unrestricted, with no plan to buy - shows no premium state, banner or
   * billing link instead of a 'No premium' it can never change.
   */
  @Expose({ groups: ['me'] })
  @IsBoolean()
  @IsOptional()
  billing?: boolean

  /**
   * When the last entitlement push said the grant lapses. After it, a SaaS
   * instance stops treating the account as premium even if no revoke ever
   * arrives. Null on accounts no push has reached with a validity yet, which
   * keeps the flag as it was.
   *
   * `update: false` here and on the revision: only UserRepository's
   * conditional UPDATE writes them, so an ordinary save of a User loaded
   * before a push landed cannot put an older revision back. No validators
   * either, for the same reason: nothing a request carries ever reaches
   * them, and they stay out of the published User schema.
   */
  @Column({ type: 'timestamptz', nullable: true, update: false })
  premiumValidUntil?: Date | null

  /**
   * When this owner's free history started to rotate: the first daily
   * retention run that found them without premium (DEC-05). Nothing of
   * theirs is removed until RetentionJob.NOTICE_DAYS after it, so an owner
   * whose plan just lapsed - or every free owner, the day the job ships - is
   * shown the notice for the full lead time before anything goes. Cleared
   * once they are premium again. Written only by UserRepository, like the
   * two columns around it.
   */
  @Column({ type: 'timestamptz', nullable: true, update: false })
  retentionNoticeFrom?: Date | null

  /** The highest entitlement revision applied; a lower one is ignored. */
  @Column({ type: 'integer', default: 0, update: false })
  entitlementRevision?: number

  /**
   * Whether the profile is public. A hidden one answers 404 to everyone but
   * its holder at GET /user/:address/address and /user/:address/identity,
   * and is left out of other people's /user/search. Only the holder reads or sets it: nobody else is
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

  /*
   * Portable identity (IdentityManager). The hosted copy of the holder's
   * CURRENT anchored presentation, and nothing older: the version history is
   * IdentityRegistry's, read from its events whenever it is shown, so no
   * table here duplicates the chain. These are columns on User rather than a
   * domain of their own because a profile presentation is the user's profile.
   *
   * None of them is in any serialization group, so no user response - public,
   * search or the holder's own - can carry them, and `select: false` keeps
   * them out of every load but the identity routes' own. `insert` and
   * `update` false: saving a User never writes them - TypeORM sets a fresh
   * row's nullable columns to null on the object it inserted, and a later
   * save of that object would otherwise wipe a presentation hosted since.
   * UserRepository writes them itself, and nothing else does.
   */

  /** The presentation as the holder anchored it (profile schema v1). */
  @Column('jsonb', { ...IDENTITY_COLUMN })
  identityPresentation?: ProfilePresentation | null

  /** The registry version the presentation is anchored as. */
  @Column('int', { ...IDENTITY_COLUMN })
  identityVersion?: number | null

  /**
   * Under hosted salt custody, the holder's private export for that
   * presentation: every field's value and salt. It lets the operator open
   * every field of the commitment, which is exactly what SPEC.md says.
   */
  @Column('jsonb', { ...IDENTITY_COLUMN })
  identityExport?: ProfileExport | null
}
