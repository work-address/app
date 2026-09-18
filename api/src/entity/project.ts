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

  public isWorker(user: User, ownerIsPremium?: boolean): boolean {
    return (
      this.isOwner(user) ||
      this.hasCollaborator(this.workerAddresses, user, ownerIsPremium)
    )
  }

  public isViewer(user: User, ownerIsPremium?: boolean): boolean {
    return (
      this.isWorker(user, ownerIsPremium) ||
      this.hasCollaborator(this.viewerAddresses, user, ownerIsPremium)
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
    ownerIsPremium?: boolean,
  ): boolean {
    // Defaults to the owner's stored flag so existing callers are unchanged.
    // A self-hosted instance has no billing service to set it, so Entitlement
    // passes `true` explicitly - see Entitlement.isPremium.
    const entitled =
      (ownerIsPremium ?? Boolean(this.user?.premium)) ||
      // A marketplace hire is the collaboration the client agreed to on
      // address.work; it does not wait for the client to buy Premium.
      Boolean(this.marketplaceContractId)

    if (!entitled) {
      return false
    }

    // Canonical on both sides: the two TON spellings of one account must
    // compare equal, and lowercasing alone does not achieve that.
    const target = WalletAddress.toCanonical(user.address ?? '')

    return (addresses ?? []).some(
      (address) => WalletAddress.toCanonical(address) === target,
    )
  }

  public static accessParams(user: User) {
    return {
      accessUserId: user.id,
      userAddress: WalletAddress.toCanonical(user.address),
    }
  }
}
