import { inject, injectable } from 'inversify'
import { Brackets, ObjectLiteral, SelectQueryBuilder } from 'typeorm'

import { Project } from '@/entity/project'
import { Time } from '@/entity/time'
import { User } from '@/entity/user'
import { Plan } from '@/service/plan'
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
  @inject('Plan')
  protected plan: Plan

  /**
   * What the project's lists say this person is. No plan is read: when an owner
   * has no plan, everyone keeps sight of the record and can still invoice what
   * they recorded. Only new tracking is limited, by `Plan.mayTrack`.
   */
  public role(project: Project, user: User): ProjectRole | null {
    if (project.isOwner(user)) return 'owner'
    if (this.isListed(project.workerAddresses, user)) return 'worker'
    if (this.isListed(project.viewerAddresses, user)) return 'viewer'
    return null
  }

  /** Whether this person works on the project, so may invoice their time. */
  public canWork(project: Project, user: User): boolean {
    const role = this.role(project, user)

    return role === 'owner' || role === 'worker'
  }

  /** `role`, as a filter: the projects this person has at least `atLeast` on. */
  public filterProjects(
    qb: SelectQueryBuilder<ObjectLiteral>,
    aliases: IAccessAliases,
    user: User,
    atLeast: 'worker' | 'viewer',
  ): void {
    this.applyFilter(qb, aliases, user, atLeast)
  }

  /**
   * The entries this person may list: an owner everyone's on the project, a
   * worker their own, a viewer none, since viewers read totals and nothing per
   * entry. Reads no plan: a worker keeps sight of their own record while they
   * may still be owed money.
   */
  public filterEntries(
    qb: SelectQueryBuilder<ObjectLiteral>,
    { project, owner }: IAccessAliases,
    user: User,
  ): void {
    qb.andWhere(
      new Brackets((access) => {
        access
          .where(`${owner}.id = :accessUserId`, { accessUserId: user.id })
          .orWhere(
            new Brackets((own) => {
              own
                .where('time."userId" = :accessUserId', {
                  accessUserId: user.id,
                })
                .andWhere(this.onList(project, 'workerAddresses'), {
                  userAddress: AccountAddress.toCanonical(user.address),
                })
            }),
          )
      }),
    )
  }

  /**
   * Selects, as `alias`, the project's rate where this person may see it: every
   * role but a viewer, as `role` answers it. Empty otherwise, so sorting by it
   * cannot read a hidden rate back through the order of the rows.
   */
  public selectVisibleRate(
    qb: SelectQueryBuilder<ObjectLiteral>,
    { project, owner }: IAccessAliases,
    user: User,
    alias: string,
  ): void {
    qb.addSelect(
      `CASE WHEN ${owner}.id = :accessUserId OR ${this.onList(project, 'workerAddresses')}
        THEN ${project}.rateHour END`,
      alias,
    ).setParameters({
      accessUserId: user.id,
      userAddress: AccountAddress.toCanonical(user.address),
    })
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
    const limit = this.plan.screenshotLimitDays()
    const days =
      limit === null
        ? 'project."screenshotRetentionDays"'
        : `LEAST(COALESCE(project."screenshotRetentionDays", ${limit}), ${limit})`

    return `(${days} IS NULL OR time."toAt" + ${days} * INTERVAL '1 day' > NOW())`
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
      time.locations = undefined
      time.detailPendingReview =
        time.project?.user?.id === user.id && !this.published(time)
    }
    // Location is kept as long as the screenshot, and goes the same way.
    const limit = this.plan.screenshotLimitDays()
    const days = time.project?.screenshotRetentionDays ?? limit
    const kept = limit === null ? days : Math.min(days ?? limit, limit)
    if (
      kept &&
      new Date(time.toAt).getTime() + kept * 86400_000 <= Date.now()
    ) {
      time.screenshot = null
      if (time.locations) time.locations = []
      if (time.locationStatus === 'ok') time.locationStatus = 'expired'
    }
    return time
  }

  private isListed(addresses: string[] | undefined, user: User): boolean {
    const target = AccountAddress.toCanonical(user.address ?? '')

    return (addresses ?? []).some(
      (address) => AccountAddress.toCanonical(address) === target,
    )
  }

  private onList(project: string, list: string): string {
    return `:userAddress = ANY(SELECT ${AccountAddress.canonicalSql('address')} FROM unnest(COALESCE(${project}.${list}, '{}')) AS address)`
  }

  private applyFilter(
    qb: SelectQueryBuilder<ObjectLiteral>,
    { project, owner }: IAccessAliases,
    user: User,
    atLeast: 'worker' | 'viewer',
  ): void {
    const userAddress = AccountAddress.toCanonical(user.address)

    qb.andWhere(
      new Brackets((access) => {
        access
          .where(`${owner}.id = :accessUserId`, { accessUserId: user.id })
          .orWhere(
            new Brackets((lists) => {
              lists.where(this.onList(project, 'workerAddresses'), {
                userAddress,
              })
              if (atLeast === 'viewer') {
                lists.orWhere(this.onList(project, 'viewerAddresses'), {
                  userAddress,
                })
              }
            }),
          )
      }),
    )
  }
}
