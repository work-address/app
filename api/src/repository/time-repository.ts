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
import { User } from '@/entity/user'
import { Project } from '@/entity/project'
import { WalletAddress } from '@/service/wallet-address'
import { Invoice } from '@/entity/invoice'
import { EProjectState } from '@/model/project'
import {
  Brackets,
  ObjectLiteral,
  OrderByCondition,
  SelectQueryBuilder,
} from 'typeorm'

import { ITimeReadOptions, ITimeSliceGroup, ITimeTotals } from '@/model/time'
import { Calc } from '@/service/calc'
import AccessException from '@/exception/access-exception'
import { TimeSearchDto } from '@/model/dto/time'

// Sort keys that don't map 1:1 onto a `time` column - they live on a
// joined table instead (projectName -> project.title).
const TIME_SORT_COLUMN_BY_KEY: Record<string, string> = {
  projectName: 'project.title',
  paidStatus: 'time.isPaid',
}

@injectable()
export class TimeRepository extends AbstractRepositoryTemplate<Time> {
  @inject('Filter')
  protected filter: Filter
  protected target = Time

  public findOneConfirmUser(time: Time, user: User): RepoEffect<Time> {
    const qb = this.getRepo()
      .createQueryBuilder('time')
      .innerJoinAndSelect('time.project', 'project')
      .innerJoin('project.user', 'owner')
      .andWhere('time.id = :timeId', { timeId: time.id })

    this.applyViewAccessFilter(qb, 'owner', user)

    return fromPromise(async () => {
      const timeEntry = await qb.select().getOne()

      if (!timeEntry) {
        throw new AccessException()
      }

      return timeEntry
    })
  }

  public getTotals(
    user: User,
    projectId: string | undefined,
  ): RepoEffect<ITimeTotals[]> {
    const qb = this.getRepo()
      .createQueryBuilder('time')
      .innerJoin('time.project', 'project')
      .innerJoin('project.user', 'owner')
      .andWhere('project.deletedAt IS NULL')

    this.applyViewAccessFilter(qb, 'owner', user)

    qb.select([
      'project.id as projectId',
      'project.rateHour as rateHour',
      // Wall-clock time covered, summed from each row's own span rather than
      // inferred from the row count: the tracker's interval has changed over
      // time, so a fixed multiplier would misread every row from before the
      // change. Distinct from `minutesActive`, which is time actually worked.
      'ROUND(SUM(EXTRACT(EPOCH FROM (time.toAt - time.fromAt)) / 60)) as minutes',
      'SUM(time.minutesActive) as minutesActive',
      'SUM(CASE WHEN COALESCE(time.isPaid, false) = true THEN time.minutesActive ELSE 0 END) as minutesPaid',
      'SUM(CASE WHEN COALESCE(time.isPaid, false) = false THEN time.minutesActive ELSE 0 END) as minutesUnpaid',
      'SUM(time.keyboardKeys) as keyboardKeys',
      'SUM(time.mouseKeys) as mouseKeys',
      'SUM(time.mouseDistance) as mouseDistance',
    ])
      .groupBy('project.id')
      .orderBy('project.id', 'ASC')

    if (projectId) {
      qb.andWhere('project.id = :projectId', { projectId })
    }

    return fromPromise(async () => {
      const result = await qb.getRawMany()

      return result.map((r) => {
        return {
          projectId: r.projectid,
          rateHour: r.ratehour,
          rateTotal: Calc.rateTotal(Number(r.minutes), r.ratehour),
          minutes: Number(r.minutes),
          minutesActive: Number(r.minutesactive),
          minutesPaid: Number(r.minutespaid),
          minutesUnpaid: Number(r.minutesunpaid),
          keyboardKeys: Number(r.keyboardkeys),
          mouseKeys: Number(r.mousekeys),
          mouseDistance: Number(r.mousedistance),
        }
      })
    })
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

    const sort = this.buildTimeOrderByCondition(s)
    const limit = this.filter.buildLimit(search)

    const qb = this.getRepo()
      .createQueryBuilder('time')
      .innerJoinAndSelect('time.project', 'project')
      .innerJoinAndSelect('time.user', 'user')
      .innerJoinAndSelect('project.user', 'owner')
      .andWhere(`project.state = :state`, { state: EProjectState.ACTIVE })
      .andWhere('project.deletedAt IS NULL')

    this.applyViewAccessFilter(qb, 'owner', user)

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
            filterQb.andWhere('time.screenshot IS NOT NULL')
            filterQb.andWhere("time.screenshot != ''")
          } else {
            filterQb.andWhere(
              "(time.screenshot IS NULL OR time.screenshot = '')",
            )
          }
        }
        if ('withProcesses' in s.filter) {
          if (s.filter.withProcesses) {
            filterQb.andWhere('time.processes IS NOT NULL')
            filterQb.andWhere("time.processes::text != '[]'")
          } else {
            filterQb.andWhere(
              "(time.processes IS NULL OR time.processes::text = '[]')",
            )
          }
        }
      }),
    )

    return fromPromise(() =>
      qb
        .select()
        .orderBy(sort)
        .skip(limit * s.page)
        .take(limit)
        .getManyAndCount(),
    )
  }

  public findByIdsConfirmAccess(ids: string[], user: User): RepoEffect<Time[]> {
    const uniqueIds = [...new Set(ids)]

    const qb = this.getRepo()
      .createQueryBuilder('time')
      .innerJoinAndSelect('time.project', 'project')
      .innerJoinAndSelect('project.user', 'owner')
      .innerJoinAndSelect('time.user', 'author')
      .andWhere('time.id IN (:...ids)', { ids: uniqueIds })

    this.applyViewAccessFilter(qb, 'owner', user)

    return fromPromise(async () => {
      const times = await qb.getMany()

      if (times.length !== uniqueIds.length) {
        throw new AccessException()
      }

      for (const time of times) {
        if (!time.isAuthor(user) && !time.project.isOwner(user)) {
          throw new AccessException()
        }
      }

      return times
    })
  }

  /**
   * Entries by id, all of which must be the user's own - one that is not, or
   * does not exist, refuses the whole set.
   *
   * Ordered by (fromAt, id) like every locking read here, so a caller that
   * locks them cannot deadlock against invoicing.
   */
  public findByIdsAsAuthor(
    ids: string[],
    user: User,
    options: ITimeReadOptions = {},
  ): RepoEffect<Time[]> {
    const uniqueIds = [...new Set(ids)]

    if (uniqueIds.length === 0) {
      return Effect.succeed([])
    }

    return fromPromise(async () => {
      const qb = this.getRepo()
        .createQueryBuilder('time')
        .innerJoinAndSelect('time.user', 'author')
        .where('time.id IN (:...ids)', { ids: uniqueIds })
        .andWhere('author.id = :userId', { userId: user.id })
        .orderBy('time.fromAt', 'ASC')
        .addOrderBy('time.id', 'ASC')

      const times = await this.lockIf(qb, options).getMany()

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
            AND (
              invoice."userId" IS NULL
              OR invoice."userId" = "${timeTable}"."userId"
            )
            AND "${timeTable}"."fromAt" < invoice."toAt"
            AND "${timeTable}"."toAt" > invoice."fromAt"
        )`,
        )
        .execute()
    })
  }

  public findTimeAsAuthorOrFail(time: Time, user: User): RepoEffect<Time> {
    return fromPromise(() =>
      this.getRepo()
        .createQueryBuilder('time')
        .innerJoinAndSelect('time.project', 'project')
        .innerJoinAndSelect('time.user', 'author')
        .andWhere('time.id = :timeId', { timeId: time.id })
        .andWhere('author.id = :userId', { userId: user.id })
        .select()
        .getOneOrFail(),
    )
  }

  public findWithProcessesForProjectSince(
    project: Project,
    fromAt: Date,
  ): RepoEffect<Time[]> {
    return fromPromise(() =>
      this.getRepo()
        .createQueryBuilder('time')
        .innerJoin('time.project', 'project')
        .andWhere('project.id = :projectId', { projectId: project.id })
        .andWhere('time.fromAt >= :fromAt', { fromAt })
        .andWhere('time.processes IS NOT NULL')
        .andWhere("time.processes::text != '[]'")
        .orderBy('time.fromAt', 'ASC')
        .getMany(),
    )
  }

  public findAllTimeForProject(
    project: Project,
    user: User,
  ): RepoEffect<Time[]> {
    const qb = this.getRepo()
      .createQueryBuilder('time')
      .innerJoinAndSelect('time.project', 'project')
      .innerJoin('project.user', 'owner')
      .andWhere('project.id = :projectId', { projectId: project.id })

    this.applyViewAccessFilter(qb, 'owner', user)

    return fromPromise(() =>
      qb.select('time').orderBy('time.fromAt', 'DESC').getMany(),
    )
  }

  /**
   * The author's own entry for a slice, if they have one - looked up on
   * exactly the unique key (project, author, fromAt), so a re-sent slice
   * finds the row it would otherwise collide with.
   *
   * Another author's entry for the same slice is not this one: two people
   * tracking one project at the same time each keep their own row.
   */
  public findAuthorsSlice(
    project: Project,
    author: User,
    fromAt: Date,
    options: ITimeReadOptions = {},
  ): RepoEffect<Time | undefined> {
    const qb = this.getRepo()
      .createQueryBuilder('time')
      .innerJoinAndSelect('time.project', 'project')
      .innerJoinAndSelect('time.user', 'user')
      .andWhere('project.id = :projectId', { projectId: project.id })
      .andWhere('user.id = :authorId', { authorId: author.id })
      .andWhere('time.fromAt = :fromAt', { fromAt })

    return fromPromise(
      async () => (await this.lockIf(qb, options).getOne()) ?? undefined,
    )
  }

  /**
   * Slices where one author has more than one row - what would stop the
   * (project, user, fromAt) key being added. Read-only, for the author-key
   * audit; soft-deleted rows count, as they do for the constraint.
   */
  public findDuplicateAuthorSlices(): RepoEffect<ITimeSliceGroup[]> {
    return this.findSliceGroups(
      '"projectId", "userId", "fromAt"',
      'count(*) > 1',
    )
  }

  /**
   * Slices held by more than one author - what the old (project, fromAt) key
   * refused and the new one keeps as separate entries. Read-only, for the
   * author-key audit.
   */
  public findSlicesSharedByAuthors(): RepoEffect<ITimeSliceGroup[]> {
    return this.findSliceGroups(
      '"projectId", "fromAt"',
      'count(DISTINCT "userId") > 1',
    )
  }

  /** Names of the unique constraints on the time table as it stands. */
  public findUniqueConstraintNames(): RepoEffect<string[]> {
    const table = this.getRepo().metadata.tableName

    return fromPromise(async () => {
      const rows: { name: string }[] = await this.getRepo().query(
        `SELECT constraint_.conname AS name
           FROM pg_constraint constraint_
           JOIN pg_class table_ ON table_.oid = constraint_.conrelid
           JOIN pg_namespace schema_ ON schema_.oid = table_.relnamespace
          WHERE table_.relname = $1
            AND schema_.nspname = current_schema()
            AND constraint_.contype = 'u'
          ORDER BY constraint_.conname`,
        [table],
      )

      return rows.map((row) => row.name)
    })
  }

  /**
   * Groups every row, deleted or not, by `groupBy` and keeps the groups
   * `having` selects. Both are fixed SQL from the methods above, never
   * request data.
   */
  private findSliceGroups(
    groupBy: string,
    having: string,
  ): RepoEffect<ITimeSliceGroup[]> {
    const table = this.getRepo().metadata.tableName

    return fromPromise(async () => {
      const rows: {
        projectId: string
        fromAt: Date
        userIds: string[]
        timeIds: string[]
      }[] = await this.getRepo().query(
        `SELECT "projectId",
                min("fromAt") AS "fromAt",
                array_agg(DISTINCT "userId"::text ORDER BY "userId"::text) AS "userIds",
                array_agg(id::text ORDER BY "createdAt", id) AS "timeIds"
           FROM "${table}"
          GROUP BY ${groupBy}
         HAVING ${having}
          ORDER BY "projectId", min("fromAt")`,
      )

      return rows.map((row) => ({
        projectId: row.projectId,
        fromAt: new Date(row.fromAt),
        userIds: row.userIds,
        timeIds: row.timeIds,
      }))
    })
  }

  /**
   * A single contributor's unpaid, uninvoiced time on one project within a
   * range - the entries an invoice for that range is built from.
   *
   * Scoped by author rather than by project owner: a worker invoices for the
   * hours *they* logged, and an owner for theirs. `findTimeBetweenForProject`
   * scopes by owner instead, which sums every contributor's hours together.
   *
   * `invoiceId IS NULL` as well as unpaid: raising an invoice does not mark
   * its hours paid, so without it a range over hours already on a REQUESTED
   * invoice re-pointed them at the new one - the first invoice kept its
   * amount but lost its lines, and the same hours were billed twice.
   */
  public findUnpaidTimeForAuthorBetween(
    from: Date,
    to: Date,
    project: Project,
    author: User,
    options: ITimeReadOptions = {},
  ): RepoEffect<Time[]> {
    const qb = this.invoiceableQuery(project, author)
      .andWhere('time.fromAt >= :from', { from })
      .andWhere('time.toAt <= :to', { to })

    return fromPromise(() => this.lockIf(qb, options).getMany())
  }

  /**
   * Every entry an invoice covers, paid or not, so reverting a payment can put
   * back exactly what marking it paid took.
   */
  public findTimeForAuthorBetween(
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
    options: ITimeReadOptions = {},
  ): RepoEffect<Time[]> {
    return fromPromise(() =>
      this.lockIf(this.invoiceableQuery(project, author), options).getMany(),
    )
  }

  /**
   * Everything of the author's on this project that no invoice covers and
   * that ended by `until`.
   *
   * No lower bound, and that is the whole point: a desktop tracker can sync a
   * Tuesday bucket on the following Monday, after the schedule has already
   * billed that week. With a lower bound at the period's own start the late
   * row would fall between two invoices and never be billed at all; with only
   * an upper bound it is swept into the next period, which is what the
   * product promises. Periods are processed oldest first, so each one takes
   * the rows that existed by the time it closed and no more.
   */
  public findUninvoicedUnpaidTimeForAuthorUntil(
    project: Project,
    author: User,
    until: Date,
    options: ITimeReadOptions = {},
  ): RepoEffect<Time[]> {
    const qb = this.invoiceableQuery(project, author).andWhere(
      'time.toAt <= :until',
      { until },
    )

    return fromPromise(() => this.lockIf(qb, options).getMany())
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
    options: ITimeReadOptions = {},
  ): RepoEffect<Time[]> {
    if (ids.length === 0) {
      return Effect.succeed([])
    }

    const qb = this.invoiceableQuery(project, author).andWhere(
      'time.id IN (:...ids)',
      { ids },
    )

    return fromPromise(() => this.lockIf(qb, options).getMany())
  }

  /**
   * Links entries to the invoice that bills them - and only entries no
   * invoice has claimed yet.
   *
   * The `invoiceId IS NULL` condition sits on the write itself, not only on
   * the read before it, so an entry already on an invoice can never be moved
   * to another one, whatever the caller read. Returns how many entries were
   * linked; the caller treats anything short of all of them as a conflict
   * and rolls the invoice back.
   */
  public claimForInvoice(invoice: Invoice, times: Time[]): RepoEffect<number> {
    const ids = times.map((time) => time.id)

    if (ids.length === 0) {
      return Effect.succeed(0)
    }

    return fromPromise(async () => {
      const result = await this.getRepo()
        .createQueryBuilder()
        .update(Time)
        .set({ invoice: { id: invoice.id } })
        .where('id IN (:...ids)', { ids })
        .andWhere('"invoiceId" IS NULL')
        .andWhere('COALESCE("isPaid", false) = false')
        .execute()

      return result.affected ?? 0
    })
  }

  /**
   * Cascades an invoice's paid state onto every entry it bills.
   *
   * Follows the `invoice` link rather than the period: the invoice's dates are
   * only the span of what it covers, and a sparse selection leaves entries in
   * between that it must not touch. The rows are locked in the same order
   * every other locking read here uses before they are written, so this
   * cannot deadlock against a concurrent paid/unpaid request on them.
   */
  public setPaidForInvoice(
    invoice: Invoice,
    isPaid: boolean,
  ): RepoEffect<void> {
    return fromPromise(async () => {
      await this.lockIf(
        this.getRepo()
          .createQueryBuilder('time')
          .select('time.id')
          .andWhere('time.invoiceId = :invoiceId', { invoiceId: invoice.id })
          .orderBy('time.fromAt', 'ASC')
          .addOrderBy('time.id', 'ASC'),
        { forUpdate: true },
      ).getMany()

      await this.getRepo()
        .createQueryBuilder()
        .update(Time)
        .set({ isPaid })
        .where('"invoiceId" = :invoiceId', { invoiceId: invoice.id })
        .execute()
    })
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

  public findTimeBetweenForProject(
    from: number,
    to: number,
    project: Project,
    freelancer: User,
  ): RepoEffect<Time[]> {
    return fromPromise(() =>
      this.getRepo()
        .createQueryBuilder('time')
        .innerJoinAndSelect('time.project', 'project')
        .innerJoin('project.user', 'owner')
        .andWhere('time.fromAt >= :from', { from: new Date(from) })
        .andWhere('time.toAt <= :to', { to: new Date(to) })
        .andWhere('owner.id = :ownerId', { ownerId: freelancer.id })
        .andWhere('project.id = :projectId', { projectId: project.id })
        .andWhere('project.deletedAt IS NULL')
        .andWhere('COALESCE(time.isPaid, false) = false')
        .getMany(),
    )
  }

  /**
   * What an author may still invoice on a project: their own entries, on a
   * live project, neither paid nor already on an invoice.
   *
   * Ordered by (fromAt, id) because the invoicing reads lock these rows: two
   * transactions taking overlapping locks in the same order wait for each
   * other instead of deadlocking.
   */
  private invoiceableQuery(
    project: Project,
    author: User,
  ): SelectQueryBuilder<Time> {
    return this.getRepo()
      .createQueryBuilder('time')
      .innerJoinAndSelect('time.project', 'project')
      .innerJoin('time.user', 'author')
      .andWhere('author.id = :authorId', { authorId: author.id })
      .andWhere('project.id = :projectId', { projectId: project.id })
      .andWhere('project.deletedAt IS NULL')
      .andWhere('COALESCE(time.isPaid, false) = false')
      .andWhere('time.invoiceId IS NULL')
      .orderBy('time.fromAt', 'ASC')
      .addOrderBy('time.id', 'ASC')
  }

  /**
   * `FOR UPDATE OF time` when the caller is about to write the rows it reads.
   *
   * Only the time rows: the joined project and author are read, not written,
   * and locking them would serialise unrelated work on the same project. A
   * waiting reader re-checks each row once the lock is released, so rows a
   * concurrent invoice claimed in the meantime drop out of its result.
   */
  private lockIf<Q extends SelectQueryBuilder<Time>>(
    qb: Q,
    options: ITimeReadOptions,
  ): Q {
    if (options.forUpdate) {
      qb.setLock('pessimistic_write', undefined, ['"time"'])
    }

    return qb
  }

  private applyViewAccessFilter(
    qb: SelectQueryBuilder<ObjectLiteral>,
    ownerAlias: string,
    user: User,
  ): void {
    const { accessUserId, userAddresses } = Project.accessParams(user)

    qb.andWhere(
      new Brackets((subQb) => {
        subQb
          .where(`${ownerAlias}.id = :accessUserId`, { accessUserId })
          .orWhere(
            WalletAddress.sqlListContains(
              'project.workerAddresses',
              'userAddresses',
            ),
            { userAddresses },
          )
          .orWhere(
            WalletAddress.sqlListContains(
              'project.viewerAddresses',
              'userAddresses',
            ),
            { userAddresses },
          )
      }),
    )
  }
}
