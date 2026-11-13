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
import { TimeLocation } from '@/entity/time-location'
import { UsageResult } from '@/service/app-usage-policy'
import { LocationResult, NO_LOCATION } from '@/service/location-policy'
import { ProjectAccess } from '@/service/project-access'
import { validate } from 'class-validator'
import ConstraintsValidationException from '@/exception/constraints-validation-exception'
import { User } from '@/entity/user'
import { Project } from '@/entity/project'
import { Invoice } from '@/entity/invoice'
import { EProjectState } from '@/model/project'
import {
  Brackets,
  EntityManager,
  In,
  ObjectLiteral,
  OrderByCondition,
  SelectQueryBuilder,
} from 'typeorm'
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity'

import AccessException from '@/exception/access-exception'
import InvoicedTimeException from '@/exception/invoiced-time-exception'
import { TimeSearchDto } from '@/model/dto/time'
import { BadRequestError } from 'routing-controllers'

/** Every order the entry list can ask for, by the name it asks with. */
const TIME_SORT_COLUMN_BY_KEY = new Map([
  ['createdAt', 'time.createdAt'],
  ['updatedAt', 'time.updatedAt'],
  ['fromAt', 'time.fromAt'],
  ['toAt', 'time.toAt'],
  ['keyboardKeys', 'time.keyboardKeys'],
  ['minutesActive', 'time.minutesActive'],
  ['mouseKeys', 'time.mouseKeys'],
  ['mouseDistance', 'time.mouseDistance'],
  ['note', 'time.note'],
  ['screenshot', 'time.screenshot'],
  ['paidStatus', 'time.isPaid'],
  ['projectName', 'project.title'],
])

/**
 * The listed columns that hold Detail. Each sorts through a guard, so adding
 * Detail to the list above means adding it here too.
 */
const DETAIL_SORT_COLUMNS = new Set([
  'time.note',
  'time.keyboardKeys',
  'time.minutesActive',
  'time.mouseKeys',
  'time.mouseDistance',
  'time.screenshot',
])

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
      await this.loadLocations([timeEntry])
      await this.loadInvoiced([timeEntry])
      return this.access.redact(timeEntry, user)
    })
  }

  public saveWithUsage(
    time: Time,
    usage: UsageResult,
    location: LocationResult = NO_LOCATION,
  ): RepoEffect<Time> {
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
          // must not restore a removed screenshot, rewrite input counts, or put
          // back a note its author has since corrected.
          time.note = existing.note
          // Which part of an invoice the time is billed in stays as published.
          time.source = existing.source
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
        // Location its author removed stays removed, published or not: the
        // phone may send the same slice again until it hears back.
        const keepLocation =
          preserveUsage || existing?.locationStatus === 'removed'
        time.locationStatus =
          keepLocation && existing ? existing.locationStatus : location.status
        const errors = await validate(time)
        if (errors.length) throw new ConstraintsValidationException(errors)
        const saved = await manager.save(Time, time)
        if (!keepLocation) {
          await manager.delete(TimeLocation, { time: { id: saved.id } })
          if (location.rows.length)
            await manager.insert(
              TimeLocation,
              location.rows.map((row) => ({ ...row, time: saved })),
            )
        }
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

  /** `limitDays` is the most any screenshot is kept, over what its project says. */
  public purgeExpiredScreenshots(
    projectIds: string[],
    limitDays: number | null = null,
  ): RepoEffect<void> {
    return fromPromise(async () => {
      if (!projectIds.length) return
      await this.getRepo().manager.query(
        `UPDATE time SET screenshot=NULL FROM project
        WHERE time."projectId"=project.id AND project.id=ANY($1::uuid[])
        AND time.screenshot IS NOT NULL
        AND LEAST(project."screenshotRetentionDays", $2::int) IS NOT NULL
        AND time."toAt" + LEAST(project."screenshotRetentionDays", $2::int) * INTERVAL '1 day' <= NOW()`,
        [projectIds, limitDays],
      )
    })
  }

  /**
   * Brings back the entries rotation hid, on the owner's upgrade. Rotation is
   * the only soft delete of an entry, so anything marked deleted here is
   * something the free plan hid: removal by an author deletes for real. Runs
   * are `AgentRunRecord.restoreRotated`.
   */
  public restoreRotated(ownerId: string): RepoEffect<void> {
    return fromPromise(async () => {
      await this.getRepo().manager.query(
        `UPDATE time SET "deletedAt"=NULL FROM project
        WHERE time."projectId"=project.id AND project."userId"=$1
        AND time."deletedAt" IS NOT NULL`,
        [ownerId],
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

  /** Each entry's fixes, in the order the phone took them. */
  public async loadLocations(times: Time[]): Promise<void> {
    if (!times.length) return
    const rows = await this.getRepo()
      .manager.getRepository(TimeLocation)
      .createQueryBuilder('location')
      .innerJoin('location.time', 'time')
      .addSelect('time.id')
      .where('time.id IN (:...ids)', { ids: times.map((time) => time.id) })
      .orderBy('location.at', 'ASC')
      .addOrderBy('location.id', 'ASC')
      .getMany()
    const byTime = new Map<string, NonNullable<Time['locations']>>()
    for (const row of rows) {
      const points = byTime.get(row.time.id) ?? []
      points.push({
        at: row.at,
        latitude: row.latitude,
        longitude: row.longitude,
        accuracy: row.accuracy,
        mock: row.mock,
      })
      byTime.set(row.time.id, points)
    }
    for (const time of times) time.locations = byTime.get(time.id) ?? []
  }

  /** The order to run, sorting Detail by what this reader may see of it. */
  private buildVisibleOrderBy(
    qb: SelectQueryBuilder<Time>,
    search: TimeSearchDto,
    user: User,
  ): OrderByCondition {
    const sort = this.filter.buildOrderByCondition(
      TIME_SORT_COLUMN_BY_KEY,
      search,
      'time entries',
    )
    const [sortColumn, sortDirection] = Object.entries(sort)[0] ?? []

    if (!DETAIL_SORT_COLUMNS.has(sortColumn)) {
      return sort
    }

    // Sort the visible value, not the secret value that will be redacted later.
    const screenshotVisible =
      sortColumn === 'time.screenshot'
        ? ` AND ${this.access.screenshotRetainedSql()}`
        : ''
    qb.addSelect(
      `CASE WHEN ${this.access.detailSql()}${screenshotVisible} THEN ${sortColumn} ELSE NULL END`,
      'visible_detail_sort',
    ).setParameter('detailUser', user.id)

    return { visible_detail_sort: sortDirection, 'time.id': 'ASC' }
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

    const limit = this.filter.buildLimit(search)

    const qb = this.getRepo()
      .createQueryBuilder('time')
      .innerJoinAndSelect('time.project', 'project')
      .innerJoinAndSelect('time.user', 'user')
      .innerJoinAndSelect('project.user', 'owner')
      .andWhere(`project.state = :state`, { state: EProjectState.ACTIVE })
      .andWhere('project.deletedAt IS NULL')

    this.access.filterEntries(qb, { project: 'project', owner: 'owner' }, user)

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
        if (s.filter.projectIds?.length) {
          filterQb.andWhere('project.id IN (:...projectIds)', {
            projectIds: s.filter.projectIds,
          })
        }
        if (s.filter.userIds?.length) {
          filterQb.andWhere('user.id IN (:...userIds)', {
            userIds: s.filter.userIds,
          })
        }
        if ('source' in s.filter) {
          filterQb.andWhere('time.source = :source', {
            source: s.filter.source,
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
      const sort = this.buildVisibleOrderBy(qb, s, user)
      const [times, count] = await qb
        .select()
        .orderBy(sort)
        .skip(limit * s.page)
        .take(limit)
        .getManyAndCount()
      await this.loadUsage(times)
      await this.loadLocations(times)
      await this.loadInvoiced(times)
      return [times.map((time) => this.access.redact(time, user)), count] as [
        Time[],
        number,
      ]
    })
  }

  private async loadInvoiced(times: Time[]): Promise<void> {
    if (!times.length) return
    const covered = await this.getRepo()
      .createQueryBuilder('time')
      .select('time.id', 'id')
      .where('time.id IN (:...ids)', { ids: times.map((time) => time.id) })
      .andWhere(this.invoicedSql())
      .getRawMany<{ id: string }>()
    const ids = new Set(covered.map(({ id }) => id))
    for (const time of times) time.isInvoiced = ids.has(time.id)
  }

  /** Sets these columns on one author's entries, invoiced or not. */
  public updateAsAuthor(
    ids: string[],
    user: User,
    values: QueryDeepPartialEntity<Time>,
  ): RepoEffect<void> {
    return this.changeAsAuthor(ids, user, (manager, uniqueIds) =>
      this.update(manager, uniqueIds, values),
    )
  }

  /** Sets these columns on one author's entries, unless any is invoiced. */
  public updateUninvoicedAsAuthor(
    ids: string[],
    user: User,
    values: QueryDeepPartialEntity<Time>,
  ): RepoEffect<void> {
    return this.changeAsAuthor(ids, user, (manager, uniqueIds) =>
      this.update(manager, uniqueIds, values, `NOT ${this.invoicedSql()}`),
    )
  }

  /**
   * An invoiced entry keeps its note, but an edit may still carry that same
   * note alongside a paid change. A blank note and no note are the same note.
   */
  public editAsAuthor(
    id: string,
    user: User,
    { note, isPaid }: { note?: string | null; isPaid?: boolean },
  ): RepoEffect<void> {
    return this.changeAsAuthor([id], user, (manager, uniqueIds) =>
      note === undefined
        ? this.update(manager, uniqueIds, {
            ...(isPaid !== undefined && { isPaid }),
          })
        : this.update(
            manager,
            uniqueIds,
            { note, ...(isPaid !== undefined && { isPaid }) },
            `(COALESCE("time"."note", '') = COALESCE(:note, '') OR NOT ${this.invoicedSql()})`,
            { note },
          ),
    )
  }

  /**
   * Removes what entries recorded about processes, and the usage built from it,
   * unless any is invoiced.
   */
  public clearProcessesAsAuthor(ids: string[], user: User): RepoEffect<void> {
    return this.changeAsAuthor(ids, user, async (manager, uniqueIds) => {
      const changed = await this.update(
        manager,
        uniqueIds,
        { processes: null },
        `NOT ${this.invoicedSql()}`,
      )
      await manager.delete(AppUsage, { time: { id: In(uniqueIds) } })
      return changed
    })
  }

  /**
   * Deletes for good, unless any is invoiced: the author asked, so unlike
   * retention nothing is kept.
   */
  public removeAsAuthor(ids: string[], user: User): RepoEffect<void> {
    return this.changeAsAuthor(ids, user, async (manager, uniqueIds) => {
      const { affected } = await manager
        .createQueryBuilder()
        .delete()
        .from(Time)
        .where('id IN (:...ids)', { ids: uniqueIds })
        .andWhere(`NOT ${this.invoicedSql()}`)
        .execute()
      return affected ?? 0
    })
  }

  /**
   * One author's entries by id, all or none: an id that isn't theirs, or a
   * change that leaves out an invoiced entry, refuses the whole batch. `change`
   * answers how many entries it changed, and throwing rolls it back.
   *
   * Never save a loaded entry here: an upload may have replaced its accounting
   * and app evidence since it was read. Locks in id order, as billing does, so
   * a change waits for an upload or an invoice in progress and sees its result.
   */
  private changeAsAuthor(
    ids: string[],
    user: User,
    change: (manager: EntityManager, uniqueIds: string[]) => Promise<number>,
  ): RepoEffect<void> {
    const uniqueIds = [...new Set(ids)]
    if (!uniqueIds.length) return Effect.void
    return fromPromise(() =>
      this.getRepo().manager.transaction(async (manager) => {
        const mine = await manager
          .createQueryBuilder(Time, 'time')
          .select('time.id')
          .where('time.id IN (:...ids) AND time.userId=:user', {
            ids: uniqueIds,
            user: user.id,
          })
          .orderBy('time.id')
          .setLock('pessimistic_write')
          .getMany()
        if (mine.length !== uniqueIds.length) throw new AccessException()
        if ((await change(manager, uniqueIds)) !== uniqueIds.length)
          throw new InvoicedTimeException()
      }),
    )
  }

  /** Writes only these columns; nothing to write leaves every entry as it is. */
  private async update(
    manager: EntityManager,
    ids: string[],
    values: QueryDeepPartialEntity<Time>,
    guard = 'TRUE',
    params: ObjectLiteral = {},
  ): Promise<number> {
    if (!Object.keys(values).length) return ids.length
    const { affected } = await manager
      .createQueryBuilder()
      .update(Time)
      .set(values)
      .where('id IN (:...ids)', { ids })
      .andWhere(guard, params)
      .execute()
    return affected ?? 0
  }

  /**
   * Whether an entry is invoiced, written against its table: billed on an
   * invoice, or inside the period of one older than frozen lines. Scoped by
   * issuer as well as project: an invoice covers only its own author's hours,
   * so one contributor's invoice must not pin a colleague's entries in the same
   * window. Legacy rows have no issuer and still protect the whole project - the
   * safe direction. Identifiers come from entity metadata, never request data.
   */
  private invoicedSql(): string {
    const time = this.getRepo().metadata.tableName
    const invoice =
      this.getRepo().manager.connection.getMetadata(Invoice).tableName

    return `EXISTS (
      SELECT 1 FROM "${invoice}" invoice
      WHERE invoice."projectId" = "${time}"."projectId"
        AND invoice."deletedAt" IS NULL
        AND invoice.state <> 'REJECTED'
        AND (
          invoice."userId" IS NULL
          OR invoice."userId" = "${time}"."userId"
        )
        AND (invoice.id = "${time}"."invoiceId" OR (invoice.lines IS NULL
          AND "${time}"."fromAt" < invoice."toAt"
          AND "${time}"."toAt" > invoice."fromAt"))
    )`
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
   * removal via removeAsAuthor still hard-deletes - that one is intentional.)
   * Invoiced entries are never purged, so a financial record always keeps its
   * supporting detail.
   */
  public softDeleteExpiredEntriesForProjects(
    projectIds: string[],
    cutoff: Date,
  ): RepoEffect<void> {
    const uniqueIds = [...new Set(projectIds)]

    if (uniqueIds.length === 0) {
      return Effect.void
    }

    const timeTable = this.getRepo().metadata.tableName

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
        .andWhere(`NOT ${this.invoicedSql()}`)
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
