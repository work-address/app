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
import { Invoice } from '@/entity/invoice'
import { EProjectState } from '@/model/project'
import {
  Brackets,
  ObjectLiteral,
  OrderByCondition,
  SelectQueryBuilder,
} from 'typeorm'

import { ITimeTotals } from '@/model/time'
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

  public findTimeSingleForProject(
    project: Project,
    from: Date,
    to: Date,
  ): RepoEffect<Time | undefined> {
    return fromPromise(() =>
      this.getRepo()
        .createQueryBuilder('time')
        .innerJoinAndSelect('time.project', 'project')
        .innerJoinAndSelect('time.user', 'user')
        .andWhere('project.id = :projectId', { projectId: project.id })
        .andWhere('time.fromAt = :from', { from })
        .andWhere('time.toAt = :to', { to })
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
        .andWhere('COALESCE(time.isPaid, false) = false')
        .getMany(),
    )
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
  ): RepoEffect<Time[]> {
    return fromPromise(() =>
      this.getRepo()
        .createQueryBuilder('time')
        .innerJoinAndSelect('time.project', 'project')
        .innerJoin('time.user', 'author')
        .andWhere('author.id = :authorId', { authorId: author.id })
        .andWhere('project.id = :projectId', { projectId: project.id })
        .andWhere('project.deletedAt IS NULL')
        .andWhere('COALESCE(time.isPaid, false) = false')
        .andWhere('time.invoiceId IS NULL')
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
        .andWhere('COALESCE(time.isPaid, false) = false')
        .andWhere('time.invoiceId IS NULL')
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

  private applyViewAccessFilter(
    qb: SelectQueryBuilder<ObjectLiteral>,
    ownerAlias: string,
    user: User,
  ): void {
    const { accessUserId, userAddress } = Project.accessParams(user)

    qb.andWhere(
      new Brackets((subQb) => {
        subQb
          .where(`${ownerAlias}.id = :accessUserId`, { accessUserId })
          .orWhere(
            `:userAddress = ANY(SELECT lower(address) FROM unnest(COALESCE(project.workerAddresses, '{}')) AS address)`,
            { userAddress },
          )
          .orWhere(
            `:userAddress = ANY(SELECT lower(address) FROM unnest(COALESCE(project.viewerAddresses, '{}')) AS address)`,
            { userAddress },
          )
      }),
    )
  }
}
