import { Effect } from 'effect'
import _ from 'lodash'
import { inject, injectable } from 'inversify'

import { Filter } from '@/service/filter'
import {
  AbstractRepositoryTemplate,
  RepoEffect,
} from '@/repository/abstract-repository-template'
import { fromPromise } from '@/service/effect-bridge'
import { Time } from '@/entity/time'
import { AppUsage } from '@/entity/app-usage'
import { UsageResult } from '@/service/app-usage-policy'
import { ProjectAccess } from '@/service/project-access'
import { validate } from 'class-validator'
import ConstraintsValidationException from '@/exception/constraints-validation-exception'
import { User } from '@/entity/user'
import { Project } from '@/entity/project'
import { Invoice } from '@/entity/invoice'
import { EProjectState } from '@/model/project'
import { Brackets, OrderByCondition } from 'typeorm'

import AccessException from '@/exception/access-exception'
import { TimeSearchDto } from '@/model/dto/time'
import { BadRequestError } from 'routing-controllers'

// Sort keys that don't map 1:1 onto a `time` column - they live on a
// joined table instead (projectName -> project.title).
const TIME_SORT_COLUMN_BY_KEY: Record<string, string> = {
  projectName: 'project.title',
  paidStatus: 'time.isPaid',
}

/** What an author may still bill: not paid by hand, and on no invoice. */
const INVOICEABLE =
  'COALESCE(time.isPaid, false) = false AND time.invoiceId IS NULL'

@injectable()
export class TimeRepository extends AbstractRepositoryTemplate<Time> {
  @inject('ProjectAccess')
  protected access: ProjectAccess
  @inject('Filter')
  protected filter: Filter
  protected target = Time

  public findOneConfirmUser(time: Time, user: User): RepoEffect<Time> {
    const qb = this.getRepo()
      .createQueryBuilder('time')
      .innerJoinAndSelect('time.project', 'project')
      .innerJoinAndSelect('project.user', 'owner')
      .innerJoinAndSelect('time.user', 'author')
      .andWhere('time.id = :timeId', { timeId: time.id })

    this.access.filterEntries(qb, { project: 'project', owner: 'owner' }, user)

    return fromPromise(async () => {
      const timeEntry = await qb.select().getOne()

      if (!timeEntry) {
        throw new AccessException()
      }

      await this.loadUsage([timeEntry])
      return this.access.redact(timeEntry, user)
    })
  }

  public saveWithUsage(time: Time, usage: UsageResult): RepoEffect<Time> {
    return fromPromise(() =>
      this.getRepo().manager.transaction(async (manager) => {
        await manager.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          [
            `time:${time.project.id}:${time.user.id}:${time.fromAt.toISOString()}`,
          ],
        )
        const existing = await manager
          .getRepository(Time)
          .createQueryBuilder('time')
          .innerJoinAndSelect('time.project', 'project')
          .leftJoinAndSelect('time.invoice', 'invoice')
          .where(
            'time.projectId=:project AND time.userId=:user AND time.fromAt=:from',
            { project: time.project.id, user: time.user.id, from: time.fromAt },
          )
          .setLock('pessimistic_write', undefined, ['time'])
          .getOne()
        const preserveUsage = existing && this.access.published(existing)
        if (
          preserveUsage &&
          (+time.toAt !== +existing.toAt ||
            time.minutesActive !== existing.minutesActive)
        )
          throw new BadRequestError(
            'Published time accounting cannot be changed by an upload',
          )
        if (existing) {
          time.id = existing.id
          time.invoice = existing.invoice
          time.publishedAt = existing.publishedAt
          time.isPaid = existing.isPaid
        }
        if (preserveUsage) {
          // Evidence never changes once the owner can see it: a desktop retry
          // must not restore a removed screenshot or rewrite input counts.
          time.screenshot = existing.screenshot
          time.processes = existing.processes
          time.keyboardKeys = existing.keyboardKeys
          time.mouseKeys = existing.mouseKeys
          time.mouseDistance = existing.mouseDistance
        }
        time.appsStatus = usage.status
        time.appsReason = usage.reason
        time.appsTruncated = usage.truncated
        if (preserveUsage) {
          time.appsStatus = existing.appsStatus
          time.appsReason = existing.appsReason
          time.appsTruncated = existing.appsTruncated
        }
        const errors = await validate(time)
        if (errors.length) throw new ConstraintsValidationException(errors)
        const saved = await manager.save(Time, time)
        if (preserveUsage) return saved
        await manager.delete(AppUsage, { time: { id: saved.id } })
        if (usage.rows.length)
          await manager.save(
            AppUsage,
            usage.rows.map((row) =>
              manager.create(AppUsage, { ...row, time: saved }),
            ),
          )
        return saved
      }),
    )
  }

  public purgeExpiredScreenshots(projectIds: string[]): RepoEffect<void> {
    return fromPromise(async () => {
      if (!projectIds.length) return
      await this.getRepo().manager.query(
        `UPDATE time SET screenshot=NULL FROM project
        WHERE time."projectId"=project.id AND project.id=ANY($1::uuid[])
        AND project."screenshotRetentionDays" IS NOT NULL AND time.screenshot IS NOT NULL
        AND time."toAt" + project."screenshotRetentionDays" * INTERVAL '1 day' <= NOW()`,
        [projectIds],
      )
    })
  }

  public async loadUsage(times: Time[]): Promise<void> {
    if (!times.length) return
    const rows = await this.getRepo()
      .manager.getRepository(AppUsage)
      .createQueryBuilder('usage')
      .innerJoinAndSelect('usage.time', 'time')
      .select(['usage', 'time.id'])
      .where('time.id IN (:...ids)', { ids: times.map((time) => time.id) })
      .getMany()
    for (const time of times) {
      const apps = new Map<string, NonNullable<Time['apps']>[number]>()
      for (const row of rows.filter((row) => row.time.id === time.id)) {
        const app = apps.get(row.app) ?? {
          name: row.app,
          seconds: 0,
          titles: [],
        }
        app.seconds += row.seconds
        if (row.title || row.domain)
          app.titles.push({
            title: row.title,
            domain: row.domain,
            seconds: row.seconds,
          })
        apps.set(row.app, app)
      }
      time.apps = [...apps.values()].sort((a, b) => b.seconds - a.seconds)
    }
  }

  private buildTimeOrderByCondition(search: TimeSearchDto): OrderByCondition {
    const [key, direction] = Object.entries(search.sort)[0] ?? []

    if (!key || !direction) {
      return {}
    }

    const column = TIME_SORT_COLUMN_BY_KEY[key] ?? `time.${key}`

    return { [column]: direction }
  }

  public findAndCount(
    search: TimeSearchDto,
    user: User,
  ): RepoEffect<[Time[], number]> {
    const s = _.assign(
      {
        filter: {},
        sort: {
          createdAt: 'ASC',
        },
        page: 0,
      },
      search,
    )

    let sort = this.buildTimeOrderByCondition(s)
    const limit = this.filter.buildLimit(search)

    const qb = this.getRepo()
      .createQueryBuilder('time')
      .innerJoinAndSelect('time.project', 'project')
      .innerJoinAndSelect('time.user', 'user')
      .innerJoinAndSelect('project.user', 'owner')
      .andWhere(`project.state = :state`, { state: EProjectState.ACTIVE })
      .andWhere('project.deletedAt IS NULL')

    this.access.filterEntries(qb, { project: 'project', owner: 'owner' }, user)

    const privateSortColumns = [
      'time.note',
      'time.keyboardKeys',
      'time.minutesActive',
      'time.mouseKeys',
      'time.mouseDistance',
      'time.screenshot',
    ]
    const [sortColumn, sortDirection] = Object.entries(sort)[0] ?? []
    if (privateSortColumns.includes(sortColumn)) {
      // Sort the visible value, not the secret value that will be redacted later.
      const screenshotVisible =
        sortColumn === 'time.screenshot'
          ? ` AND ${this.access.screenshotRetainedSql()}`
          : ''
      qb.addSelect(
        `CASE WHEN ${this.access.detailSql()}${screenshotVisible} THEN ${sortColumn} ELSE NULL END`,
        'visible_detail_sort',
      ).setParameter('detailUser', user.id)
      sort = { visible_detail_sort: sortDirection, 'time.id': 'ASC' }
    }

    const detailFilters = [
      'screenshot',
      'withScreenshots',
      'withProcesses',
      'note',
      'keyboardKeysFrom',
      'keyboardKeysTo',
      'minutesActiveFrom',
      'minutesActiveTo',
      'mouseKeysFrom',
      'mouseKeysTo',
      'mouseDistanceFrom',
      'mouseDistanceTo',
    ]
    if (detailFilters.some((key) => key in s.filter)) {
      qb.andWhere(this.access.detailSql(), { detailUser: user.id })
    }
    qb.andWhere(
      new Brackets((filterQb) => {
        if ('projectId' in s.filter) {
          filterQb.andWhere('project.id = :projectId', {
            projectId: s.filter.projectId,
          })
        }
        if ('fromAt' in s.filter) {
          filterQb.andWhere('time.fromAt >= :fromAt', {
            fromAt: s.filter.fromAt,
          })
        }
        if ('toAt' in s.filter) {
          filterQb.andWhere('time.toAt <= :toAt', {
            toAt: s.filter.toAt,
          })
        }
        if ('note' in s.filter) {
          filterQb.andWhere('time.note ILIKE :note', {
            note: `%${s.filter.note}%`,
          })
        }
        if ('screenshot' in s.filter) {
          filterQb.andWhere(this.access.screenshotRetainedSql())
          filterQb.andWhere('time.screenshot ILIKE :screenshot', {
            screenshot: `%${s.filter.screenshot}%`,
          })
        }
        if ('keyboardKeysFrom' in s.filter) {
          filterQb.andWhere('time.keyboardKeys >= :keyboardKeysFrom', {
            keyboardKeysFrom: s.filter.keyboardKeysFrom,
          })
        }
        if ('keyboardKeysTo' in s.filter) {
          filterQb.andWhere('time.keyboardKeys <= :keyboardKeysTo', {
            keyboardKeysTo: s.filter.keyboardKeysTo,
          })
        }
        if ('minutesActiveFrom' in s.filter) {
          filterQb.andWhere('time.minutesActive >= :minutesActiveFrom', {
            minutesActiveFrom: s.filter.minutesActiveFrom,
          })
        }
        if ('minutesActiveTo' in s.filter) {
          filterQb.andWhere('time.minutesActive <= :minutesActiveTo', {
            minutesActiveTo: s.filter.minutesActiveTo,
          })
        }
        if ('mouseKeysFrom' in s.filter) {
          filterQb.andWhere('time.mouseKeys >= :mouseKeysFrom', {
            mouseKeysFrom: s.filter.mouseKeysFrom,
          })
        }
        if ('mouseKeysTo' in s.filter) {
          filterQb.andWhere('time.mouseKeys <= :mouseKeysTo', {
            mouseKeysTo: s.filter.mouseKeysTo,
          })
        }
        if ('mouseDistanceFrom' in s.filter) {
          filterQb.andWhere('time.mouseDistance >= :mouseDistanceFrom', {
            mouseDistanceFrom: s.filter.mouseDistanceFrom,
          })
        }
        if ('mouseDistanceTo' in s.filter) {
          filterQb.andWhere('time.mouseDistance <= :mouseDistanceTo', {
            mouseDistanceTo: s.filter.mouseDistanceTo,
          })
        }
        if ('withScreenshots' in s.filter) {
          if (s.filter.withScreenshots) {
            filterQb.andWhere(this.access.screenshotRetainedSql())
            filterQb.andWhere('time.screenshot IS NOT NULL')
            filterQb.andWhere("time.screenshot != ''")
          } else {
            filterQb.andWhere(
              `(time.screenshot IS NULL OR time.screenshot = '' OR NOT ${this.access.screenshotRetainedSql()})`,
            )
          }
        }
        if ('withProcesses' in s.filter) {
          // Current trackers store apps in app_usage; older rows only in processes.
          const hasProcesses = `((time.processes IS NOT NULL AND time.processes::text != '[]')
            OR EXISTS (SELECT 1 FROM app_usage usage WHERE usage."timeId" = time.id))`
          filterQb.andWhere(
            s.filter.withProcesses ? hasProcesses : `NOT ${hasProcesses}`,
          )
        }
      }),
    )

    return fromPromise(async () => {
      const [times, count] = await qb
        .select()
        .orderBy(sort)
        .skip(limit * s.page)
        .take(limit)
        .getManyAndCount()
      await this.loadUsage(times)
      return [times.map((time) => this.access.redact(time, user)), count] as [
        Time[],
        number,
      ]
    })
  }

  /** Removes what entries recorded about processes, and the usage built from it. */
  public clearProcesses(times: Time[]): RepoEffect<void> {
    for (const time of times) {
      time.processes = null
    }

    return fromPromise(() =>
      this.getRepo().manager.transaction(async (manager) => {
        await manager.save(Time, times)
        for (const time of times)
          await manager.delete(AppUsage, { time: { id: time.id } })
      }),
    )
  }

  public publishAsAuthor(ids: string[], user: User): RepoEffect<void> {
    const uniqueIds = [...new Set(ids)]
    if (!uniqueIds.length) return Effect.void
    return fromPromise(() =>
      this.getRepo().manager.transaction(async (manager) => {
        // Never save a loaded entry here: uploads may have replaced its accounting
        // and app evidence since the ownership check. Retain the first publication.
        const result = await manager
          .createQueryBuilder()
          .update(Time)
          .set({
            publishedAt: () => 'COALESCE("publishedAt", CURRENT_TIMESTAMP)',
          })
          .where('id IN (:...ids) AND "userId"=:user AND "deletedAt" IS NULL', {
            ids: uniqueIds,
            user: user.id,
          })
          .execute()
        if (result.affected !== uniqueIds.length) throw new AccessException()
      }),
    )
  }

  public findByIdsAsAuthor(ids: string[], user: User): RepoEffect<Time[]> {
    const uniqueIds = [...new Set(ids)]

    if (uniqueIds.length === 0) {
      return Effect.succeed([])
    }

    return fromPromise(async () => {
      const times = await this.getRepo()
        .createQueryBuilder('time')
        .innerJoinAndSelect('time.user', 'author')
        .where('time.id IN (:...ids)', { ids: uniqueIds })
        .andWhere('author.id = :userId', { userId: user.id })
        .getMany()

      if (times.length !== uniqueIds.length) {
        throw new AccessException()
      }

      return times
    })
  }

  /**
   * Free-tier retention: a project owned by a non-premium account keeps only
   * the trailing N days of time logs.
   *
   * Retention follows the *project owner's* tier rather than the author's,
   * because a project's log is the owner's record - entries a free-tier
   * worker recorded on a premium owner's project are part of the history that
   * owner is paying to keep, and must not be swept up by the worker's own
   * tier. Callers pass the projects they touched, so the purge stays scoped
   * to projects that were actually written to.
   *
   * Soft-deletes rather than hard-deletes: this runs automatically, without
   * the user asking for it, so it stays reversible on upgrade. (User-initiated
   * removal via removeMany still hard-deletes - that one is intentional.)
   * Entries backing an issued invoice are never purged, so a financial record
   * always keeps its supporting detail.
   */
  public softDeleteExpiredEntriesForProjects(
    projectIds: string[],
    cutoff: Date,
  ): RepoEffect<void> {
    const uniqueIds = [...new Set(projectIds)]

    if (uniqueIds.length === 0) {
      return Effect.void
    }

    // Identifiers come from entity metadata, never from request data.
    const timeTable = this.getRepo().metadata.tableName
    const invoiceTable =
      this.getRepo().manager.connection.getMetadata(Invoice).tableName

    return fromPromise(async () => {
      await this.getRepo()
        .createQueryBuilder()
        .softDelete()
        .from(Time)
        .where(`"${timeTable}"."projectId" IN (:...projectIds)`, {
          projectIds: uniqueIds,
        })
        .andWhere(`"${timeTable}"."fromAt" < :cutoff`, { cutoff })
        .andWhere(`"${timeTable}"."deletedAt" IS NULL`)
        .andWhere(
          // Scoped by issuer as well as project: an invoice covers only its
          // own author's hours, so one contributor's invoice must not pin a
          // colleague's entries in the same window. Legacy rows have no issuer
          // and still protect the whole project - the safe direction.
          `NOT EXISTS (
          SELECT 1 FROM "${invoiceTable}" invoice
          WHERE invoice."projectId" = "${timeTable}"."projectId"
            AND invoice."deletedAt" IS NULL
            AND invoice.state <> 'REJECTED'
            AND (
              invoice."userId" IS NULL
              OR invoice."userId" = "${timeTable}"."userId"
            )
            AND (invoice.id = "${timeTable}"."invoiceId" OR (invoice.lines IS NULL
              AND "${timeTable}"."fromAt" < invoice."toAt"
              AND "${timeTable}"."toAt" > invoice."fromAt"))
        )`,
        )
        .execute()
    })
  }

  public findTimeSingleForProject(
    project: Project,
    from: Date,
    to: Date,
    author?: User,
  ): RepoEffect<Time | undefined> {
    return fromPromise(() =>
      this.getRepo()
        .createQueryBuilder('time')
        .innerJoinAndSelect('time.project', 'project')
        .innerJoinAndSelect('time.user', 'user')
        .andWhere('project.id = :projectId', { projectId: project.id })
        .andWhere('time.fromAt = :from', { from })
        .andWhere(
          author ? 'user.id = :authorId' : 'time.toAt = :to',
          author ? { authorId: author.id } : { to },
        )
        .leftJoinAndSelect('time.invoice', 'invoice')
        .getOne()
        .then((result) => result ?? undefined),
    )
  }

  /**
   * A single contributor's unpaid time on one project within a range - the
   * entries an invoice is built from.
   *
   * Scoped by author rather than by project owner: a worker invoices for the
   * hours *they* logged, and an owner for theirs. `findTimeBetweenForProject`
   * scopes by owner instead, which sums every contributor's hours together.
   */
  public findUnpaidTimeForAuthorBetween(
    from: Date,
    to: Date,
    project: Project,
    author: User,
  ): RepoEffect<Time[]> {
    return fromPromise(() =>
      this.getRepo()
        .createQueryBuilder('time')
        .innerJoinAndSelect('time.project', 'project')
        .innerJoin('time.user', 'author')
        .andWhere('time.fromAt >= :from', { from })
        .andWhere('time.toAt <= :to', { to })
        .andWhere('author.id = :authorId', { authorId: author.id })
        .andWhere('project.id = :projectId', { projectId: project.id })
        .andWhere('project.deletedAt IS NULL')
        .andWhere(INVOICEABLE)
        .getMany(),
    )
  }

  /**
   * The caller's unpaid time on a project that no invoice of theirs already
   * covers.
   *
   * "Unpaid" alone is not enough: creating an invoice does not mark its hours
   * paid - only settling it does - so a second click would raise a second
   * invoice for the same hours and bill them twice. The `invoiceId` link is
   * what makes the operation idempotent, and it is exact: a period-overlap
   * test would also claim entries between two selected days that nobody
   * chose to bill.
   */
  public findUninvoicedUnpaidTimeForAuthor(
    project: Project,
    author: User,
  ): RepoEffect<Time[]> {
    return fromPromise(() =>
      this.getRepo()
        .createQueryBuilder('time')
        .innerJoinAndSelect('time.project', 'project')
        .innerJoin('time.user', 'author')
        .andWhere('author.id = :authorId', { authorId: author.id })
        .andWhere('project.id = :projectId', { projectId: project.id })
        .andWhere('project.deletedAt IS NULL')
        .andWhere(INVOICEABLE)
        .orderBy('time.fromAt', 'ASC')
        .getMany(),
    )
  }

  /**
   * Specific entries, restricted to ones the author may still invoice.
   *
   * Filtered rather than fetched-then-checked so an id belonging to someone
   * else, to another project, or to already-billed work simply does not come
   * back - the caller compares counts and refuses the whole request.
   */
  public findInvoiceableByIds(
    ids: string[],
    project: Project,
    author: User,
  ): RepoEffect<Time[]> {
    if (ids.length === 0) {
      return Effect.succeed([])
    }

    return fromPromise(() =>
      this.getRepo()
        .createQueryBuilder('time')
        .innerJoinAndSelect('time.project', 'project')
        .innerJoin('time.user', 'author')
        .andWhere('time.id IN (:...ids)', { ids })
        .andWhere('author.id = :authorId', { authorId: author.id })
        .andWhere('project.id = :projectId', { projectId: project.id })
        .andWhere('project.deletedAt IS NULL')
        .andWhere(INVOICEABLE)
        .orderBy('time.fromAt', 'ASC')
        .getMany(),
    )
  }

  /** Everything an invoice bills, by link rather than by period. */
  public findForInvoice(invoice: Invoice): RepoEffect<Time[]> {
    return fromPromise(() =>
      this.getRepo()
        .createQueryBuilder('time')
        .andWhere('time.invoiceId = :invoiceId', { invoiceId: invoice.id })
        .getMany(),
    )
  }

  /**
   * The same entries as {@link findForInvoice}, for display only.
   *
   * Omits `screenshot` and `processes`: an invoice can bill hundreds of
   * entries and a screenshot runs to hundreds of kilobytes, none of which the
   * invoice renders. Rows from here are partial and must never be saved back -
   * that is what {@link findForInvoice} is for.
   */
  public findForInvoiceSummary(invoice: Invoice): RepoEffect<Time[]> {
    return fromPromise(() =>
      this.getRepo()
        .createQueryBuilder('time')
        .select([
          'time.id',
          'time.createdAt',
          'time.updatedAt',
          'time.isPaid',
          'time.note',
          'time.minutesActive',
          'time.keyboardKeys',
          'time.mouseKeys',
          'time.mouseDistance',
          'time.fromAt',
          'time.toAt',
        ])
        .andWhere('time.invoiceId = :invoiceId', { invoiceId: invoice.id })
        .orderBy('time.fromAt', 'DESC')
        .getMany(),
    )
  }
}
