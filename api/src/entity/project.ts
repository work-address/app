import { Column, Entity, Index, ManyToOne, OneToMany } from 'typeorm'
import { faker } from '@faker-js/faker'
import { Exclude, Expose, Type } from 'class-transformer'
import { JSONSchema } from 'class-validator-jsonschema'

import { User } from '@/entity/user'
import { WalletAddress } from '@/service/wallet-address'
import { AbstractBaseEntity } from '@/entity/abstract-base-entity'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { EProjectState } from '@/model/project'
import { Invoice } from '@/entity/invoice'
import { ProjectStatistics } from '@/entity/project-statistics'
import { Time } from '@/entity/time'
import {
  IInvoiceCadenceConsent,
  IInvoiceCadenceVersion,
  IMarketplaceTermsVersion,
  IProject,
} from '@/model/project'
import { InvoiceCadence } from '@/service/invoice-cadence'
import { MarketplaceTerms } from '@/service/marketplace-terms'

// Access lists are unnested on every access check, so they stay bounded.
// Addresses are free-form strings (a wallet may not have an account yet),
// which is exactly why they need a ceiling. Module scope, not static fields:
// decorator arguments are evaluated before static initializers run.
export const MAX_COLLABORATORS = 100
export const MAX_ADDRESS_LENGTH = 128

// A week has 168 hours, so a cap above it caps nothing. Same ceiling as the
// marketplace offer's, which is where every hired project's cap comes from.
export const MAX_WEEKLY_LIMIT_HOURS = 168

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

  /**
   * Hours a week this project's worker may record, or null for no cap.
   *
   * A term of the agreement rather than a tracker setting: a marketplace
   * hire carries the cap the freelancer accepted, and `TimeManager` measures
   * every contract week against it. Kept on the project for the same reason
   * the rate is - it describes this piece of work, not the account doing it.
   */
  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('integer', { nullable: true })
  @IsInt()
  @Min(1)
  @Max(MAX_WEEKLY_LIMIT_HOURS)
  @IsOptional()
  weeklyLimit?: number | null

  /**
   * When this project's first weekly period opens; the weeks run seven days
   * at a time from it.
   *
   * A marketplace hire sends the contract's own start, so the week the cap
   * is measured against here is the same seven days the marketplace shows
   * hours for. Null on a project created here directly, whose weeks then run
   * from when the project itself was created - the only start it has.
   */
  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('timestamptz', { nullable: true })
  @IsDate()
  @IsOptional()
  weeklyPeriodStartsAt?: Date | null

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

  /**
   * The marketplace contract this project was created for, when a client hired
   * someone on address.work. Unique, so a retried hire finds the project it
   * already made instead of creating a second one; null for every project
   * created here directly.
   */
  @Expose({ groups: ['search'] })
  @Index({ unique: true })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  marketplaceContractId?: string | null

  /**
   * Every version of the marketplace contract's terms this project was told
   * about, oldest first; null for a project never amended, and for every
   * project created here directly.
   *
   * A jsonb array rather than a table for the reason the cadence below is
   * one (five domains, SPEC.md). Versioned rather than overwritten because
   * an amendment changes the rate from a date, not backwards: hours worked
   * before it keep the rate agreed for them whenever they are invoiced
   * (`MarketplaceTerms.billable`). The columns above - rate, cap, flags -
   * always hold the newest version, which is what the tracker applies now.
   *
   * Not `@Expose`d: it is the pricing history of a hire, and only the
   * signed marketplace call writes it.
   */
  @Column('jsonb', { nullable: true })
  @IsArray()
  @ArrayMaxSize(MarketplaceTerms.MAX_VERSIONS)
  @IsOptional()
  marketplaceTerms?: IMarketplaceTermsVersion[] | null

  /**
   * The project's invoicing cadence, every version of it, oldest first.
   *
   * A jsonb array on the project rather than a table of its own: a cadence is
   * a property of a project the way its rate is, and app has exactly five
   * domains (SPEC.md, "No new domains"). Versioned rather than overwritten so
   * that an invoice the schedule already issued keeps the rule it was issued
   * under - see `IInvoiceCadenceVersion` and `InvoiceCadence`.
   *
   * Null on every project that never set one, which is what "no automatic
   * invoicing" means. Only the owner may write it (ProjectController).
   *
   * Deliberately NOT `@Expose`d: the class is `@Exclude()`d, so leaving the
   * decorator off keeps this column out of every Project response. It is read
   * through `GET /project/:id/cadence` alone, which is worker-or-owner - a
   * viewer gets 403. Exposing it under the `search` group would have handed
   * the money schedule to every viewer of `GET /project/:id` and
   * `POST /project/search`, deciding that access rule a second time and
   * letting the looser answer win.
   */
  @Column('jsonb', { nullable: true })
  @IsArray()
  @ArrayMaxSize(InvoiceCadence.MAX_VERSIONS)
  @IsOptional()
  invoiceCadence?: IInvoiceCadenceVersion[] | null

  /**
   * Who has agreed to have their hours invoiced for them, one entry per
   * person who has answered.
   *
   * Consent is to the automatic issuance of a financial document in your own
   * name, so it is recorded per project and per worker and nobody is enrolled
   * by default: a project with a cadence and no consent issues nothing.
   * Alongside the cadence rather than on User for the same reason the cadence
   * is here - it is a fact about this project, not about the account.
   *
   * Not `@Expose`d, and for a sharper reason than the cadence above: this is
   * the whole roster, each entry carrying another person's internal user id,
   * wallet address and the moment they decided. `ProjectManager.cadenceView`
   * narrows it to the caller's own `consented` on purpose; serializing the
   * raw column on the project would have published everyone else's answer.
   */
  @Column('jsonb', { nullable: true })
  @IsArray()
  @ArrayMaxSize(MAX_COLLABORATORS)
  @IsOptional()
  invoiceCadenceConsent?: IInvoiceCadenceConsent[] | null

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
   * Mirrors the SQL access filters in ProjectRepository and TimeRepository:
   * membership is the address alone, matched with `WalletAddress.isSame`,
   * whose SQL half (`WalletAddress.sqlListContains`) those filters use. The
   * owner's plan does not enter into it - collaborators are free, and premium
   * governs retention only. Kept in step with those filters deliberately -
   * two different answers to "who may see this project" is how access bugs
   * start.
   */
  private hasCollaborator(
    addresses: string[] | undefined,
    user: User,
  ): boolean {
    // Chain-aware on both sides: the two TON spellings of one account must
    // compare equal, and an EVM address ignores case, but a Solana address
    // does not - base58 is case-sensitive.
    return (addresses ?? []).some((address) =>
      WalletAddress.isSame(address, user.address ?? ''),
    )
  }

  /**
   * Parameters for the SQL access filters: the user's id for ownership, and
   * every canonical form a list entry naming them can take
   * (`WalletAddress.matchForms`) for membership.
   */
  public static accessParams(user: User) {
    return {
      accessUserId: user.id,
      userAddresses: WalletAddress.matchForms(user.address),
    }
  }
}
