import { inject, injectable } from 'inversify'
import { Brackets, ObjectLiteral, SelectQueryBuilder } from 'typeorm'

import { Project } from '@/entity/project'
import { Time } from '@/entity/time'
import { User } from '@/entity/user'
import { Entitlement } from '@/service/entitlement'
import { AccountAddress } from '@/service/account-address'

export type ProjectRole = 'owner' | 'worker' | 'viewer'

/** Where a query joined the project and its owner, so filters can name them. */
export interface IAccessAliases {
  project: string
  owner: string
}

const DEFAULT_REVIEW_WINDOW_HOURS = 24

/**
 * Who may do what to a project and its entries (SPEC.md, "Who can see what"),
 * answered both per row and as a query filter so the two cannot disagree. The
 * test matrix in test/service/project-access.test.ts holds them to that.
 */
@injectable()
export class ProjectAccess {
  @inject('Entitlement')
  protected entitlement: Entitlement

  /** What the project's lists say this person is, whatever the owner's plan. */
  public role(project: Project, user: User): ProjectRole | null {
    if (project.isOwner(user)) return 'owner'
    if (this.isListed(project.workerAddresses, user)) return 'worker'
    if (this.isListed(project.viewerAddresses, user)) return 'viewer'
    return null
  }

  /** What that role grants today: a collaborator's needs a plan on the owner. */
  public access(project: Project, user: User): ProjectRole | null {
    const role = this.role(project, user)

    return role === 'owner' || this.entitlement.isPremium(project.user)
      ? role
      : null
  }

  /** Whether this person may record and invoice time on the project today. */
  public canWork(project: Project, user: User): boolean {
    const access = this.access(project, user)

    return access === 'owner' || access === 'worker'
  }

  /** `access`, as a filter: the projects this person has at least `atLeast` on. */
  public filterProjects(
    qb: SelectQueryBuilder<ObjectLiteral>,
    aliases: IAccessAliases,
    user: User,
    atLeast: 'worker' | 'viewer',
  ): void {
    // Self-hosted instances omit the predicate rather than relying on column
    // data - see Entitlement.shouldFilterByPremium.
    this.applyFilter(
      qb,
      aliases,
      user,
      atLeast,
      this.entitlement.shouldFilterByPremium(),
    )
  }

  /**
   * The entries of the projects this person is on. Reads no plan: collaborators
   * are decided to be free (web/PRODUCT.md §7 #2), and a worker keeps sight of
   * their own record while they may still be owed money.
   */
  public filterEntries(
    qb: SelectQueryBuilder<ObjectLiteral>,
    aliases: IAccessAliases,
    user: User,
  ): void {
    this.applyFilter(qb, aliases, user, 'viewer', false)
  }

  /** Whether the review window of an entry ending at `toAt` is over. */
  public reviewEnded(
    toAt: Date,
    reviewWindowHours: number | null | undefined,
    now = Date.now(),
  ): boolean {
    const hours = reviewWindowHours ?? DEFAULT_REVIEW_WINDOW_HOURS

    return new Date(toAt).getTime() + hours * 3600_000 <= now
  }

  /** Whether an entry's detail has reached its owner. */
  public published(time: Time, now = Date.now()): boolean {
    return Boolean(
      time.publishedAt ||
        time.invoiceId ||
        this.reviewEnded(time.toAt, time.project?.reviewWindowHours, now),
    )
  }

  public publishedSql(): string {
    return `(time."publishedAt" IS NOT NULL OR time."invoiceId" IS NOT NULL OR
      time."toAt" + COALESCE(project."reviewWindowHours",${DEFAULT_REVIEW_WINDOW_HOURS}) * INTERVAL '1 hour' <= NOW())`
  }

  public canSeeDetail(time: Time, user: User, now = Date.now()): boolean {
    return (
      time.user?.id === user.id ||
      (time.project?.user?.id === user.id && this.published(time, now))
    )
  }

  public detailSql(): string {
    return `(time."userId"=:detailUser OR (project."userId"=:detailUser AND ${this.publishedSql()}))`
  }

  public screenshotRetainedSql(): string {
    return `(project."screenshotRetentionDays" IS NULL OR time."toAt" + project."screenshotRetentionDays" * INTERVAL '1 day' > NOW())`
  }

  /** Strips from an entry what this person may not see. */
  public redact(time: Time, user: User): Time {
    if (!this.canSeeDetail(time, user)) {
      time.note = null
      time.minutesActive = null
      time.keyboardKeys = null
      time.mouseKeys = null
      time.mouseDistance = null
      time.screenshot = null
      time.processes = null
      time.apps = undefined
      time.appsReason = null
      time.detailPendingReview =
        time.project?.user?.id === user.id && !this.published(time)
    }
    if (
      time.project?.screenshotRetentionDays &&
      new Date(time.toAt).getTime() +
        time.project.screenshotRetentionDays * 86400_000 <=
        Date.now()
    )
      time.screenshot = null
    return time
  }

  private isListed(addresses: string[] | undefined, user: User): boolean {
    const target = AccountAddress.toCanonical(user.address ?? '')

    return (addresses ?? []).some(
      (address) => AccountAddress.toCanonical(address) === target,
    )
  }

  private applyFilter(
    qb: SelectQueryBuilder<ObjectLiteral>,
    { project, owner }: IAccessAliases,
    user: User,
    atLeast: 'worker' | 'viewer',
    gated: boolean,
  ): void {
    const userAddress = AccountAddress.toCanonical(user.address)
    const isOnList = (list: string) =>
      `:userAddress = ANY(SELECT ${AccountAddress.canonicalSql('address')} FROM unnest(COALESCE(${project}.${list}, '{}')) AS address)`

    qb.andWhere(
      new Brackets((access) => {
        access
          .where(`${owner}.id = :accessUserId`, { accessUserId: user.id })
          .orWhere(
            new Brackets((collaborator) => {
              const listed = new Brackets((lists) => {
                lists.where(isOnList('workerAddresses'), { userAddress })
                if (atLeast === 'viewer') {
                  lists.orWhere(isOnList('viewerAddresses'), { userAddress })
                }
              })

              if (gated) {
                collaborator.where(`${owner}.premium = true`).andWhere(listed)
              } else {
                collaborator.where(listed)
              }
            }),
          )
      }),
    )
  }
}
