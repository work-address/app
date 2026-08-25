import _ from 'lodash'
import { inject, injectable } from 'inversify'

import { Filter } from '@/service/filter'
import { AbstractRepositoryTemplate } from '@/repository/abstract-repository-template'
import { Time } from '@/entity/time'
import { User } from '@/entity/user'
import { Project } from '@/entity/project'
import { Invoice } from '@/entity/invoice'
import { EProjectState } from '@/model/project'
import { Brackets, OrderByCondition, SelectQueryBuilder } from 'typeorm'

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

  public async findOneConfirmUser(time: Time, user: User): Promise<Time> {
    const qb = this.getRepo()
      .createQueryBuilder('time')
      .innerJoinAndSelect('time.project', 'project')
      .innerJoin('project.user', 'owner')
      .andWhere('time.id = :timeId', { timeId: time.id })

    this.applyViewAccessFilter(qb, 'owner', user)

    const timeEntry = await qb.select().getOne()

    if (!timeEntry) {
      throw new AccessException()
    }

    return timeEntry
  }

  public async getTotals(
    user: User,
    projectId: string | undefined,
  ): Promise<ITimeTotals[]> {
    const qb = this.getRepo()
      .createQueryBuilder('time')
      .innerJoin('time.project', 'project')
      .innerJoin('project.user', 'owner')
      .andWhere('project.deletedAt IS NULL')

    this.applyViewAccessFilter(qb, 'owner', user)

    qb.select([
      'project.id as projectId',
      'project.rateHour as rateHour',
      'COUNT(time.id) as minutes',
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

    const result = await qb.getRawMany()

    return result.map((r) => {
      return {
        projectId: r.projectid,
        rateHour: r.ratehour,
        rateTotal: Calc.rateTotal(r.minutes * 10, r.ratehour),
        minutes: Number(r.minutes * 10),
        minutesActive: Number(r.minutesactive),
        minutesPaid: Number(r.minutespaid),
        minutesUnpaid: Number(r.minutesunpaid),
        keyboardKeys: Number(r.keyboardkeys),
        mouseKeys: Number(r.mousekeys),
        mouseDistance: Number(r.mousedistance),
      }
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
  ): Promise<[Time[], number]> {
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

    return qb
      .select()
      .orderBy(sort)
      .skip(limit * s.page)
      .take(limit)
      .getManyAndCount()
  }

  public async findByIdsConfirmAccess(
    ids: string[],
    user: User,
  ): Promise<Time[]> {
    const uniqueIds = [...new Set(ids)]

    const qb = this.getRepo()
      .createQueryBuilder('time')
      .innerJoinAndSelect('time.project', 'project')
      .innerJoinAndSelect('project.user', 'owner')
      .innerJoinAndSelect('time.user', 'author')
      .andWhere('time.id IN (:...ids)', { ids: uniqueIds })

    this.applyViewAccessFilter(qb, 'owner', user)

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
  }

  public async findByIdsAsAuthor(ids: string[], user: User): Promise<Time[]> {
    const uniqueIds = [...new Set(ids)]

    if (uniqueIds.length === 0) {
      return []
    }

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
  public async softDeleteExpiredEntriesForProjects(
    projectIds: string[],
    cutoff: Date,
  ): Promise<void> {
    const uniqueIds = [...new Set(projectIds)]

    if (uniqueIds.length === 0) {
      return
    }

    // Identifiers come from entity metadata, never from request data.
    const timeTable = this.getRepo().metadata.tableName
    const invoiceTable =
      this.getRepo().manager.connection.getMetadata(Invoice).tableName

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
        `NOT EXISTS (
          SELECT 1 FROM "${invoiceTable}" invoice
          WHERE invoice."projectId" = "${timeTable}"."projectId"
            AND invoice."deletedAt" IS NULL
            AND "${timeTable}"."fromAt" < invoice."toAt"
            AND "${timeTable}"."toAt" > invoice."fromAt"
        )`,
      )
      .execute()
  }

  public findTimeAsAuthorOrFail(time: Time, user: User): Promise<Time> {
    return this.getRepo()
      .createQueryBuilder('time')
      .innerJoinAndSelect('time.project', 'project')
      .innerJoinAndSelect('time.user', 'author')
      .andWhere('time.id = :timeId', { timeId: time.id })
      .andWhere('author.id = :userId', { userId: user.id })
      .select()
      .getOneOrFail()
  }

  public findWithProcessesForProjectSince(
    project: Project,
    fromAt: Date,
  ): Promise<Time[]> {
    return this.getRepo()
      .createQueryBuilder('time')
      .innerJoin('time.project', 'project')
      .andWhere('project.id = :projectId', { projectId: project.id })
      .andWhere('time.fromAt >= :fromAt', { fromAt })
      .andWhere('time.processes IS NOT NULL')
      .andWhere("time.processes::text != '[]'")
      .orderBy('time.fromAt', 'ASC')
      .getMany()
  }

  public findAllTimeForProject(project: Project, user: User): Promise<Time[]> {
    const qb = this.getRepo()
      .createQueryBuilder('time')
      .innerJoinAndSelect('time.project', 'project')
      .innerJoin('project.user', 'owner')
      .andWhere('project.id = :projectId', { projectId: project.id })

    this.applyViewAccessFilter(qb, 'owner', user)

    return qb.select('time').orderBy('time.fromAt', 'DESC').getMany()
  }

  public findTimeSingleForProject(
    project: Project,
    from: Date,
    to: Date,
  ): Promise<Time | undefined> {
    return this.getRepo()
      .createQueryBuilder('time')
      .innerJoinAndSelect('time.project', 'project')
      .innerJoinAndSelect('time.user', 'user')
      .andWhere('project.id = :projectId', { projectId: project.id })
      .andWhere('time.fromAt = :from', { from })
      .andWhere('time.toAt = :to', { to })
      .getOne()
  }

  public findTimeBetweenForProject(
    from: number,
    to: number,
    project: Project,
    freelancer: User,
  ): Promise<Time[]> {
    return this.getRepo()
      .createQueryBuilder('time')
      .innerJoinAndSelect('time.project', 'project')
      .innerJoin('project.user', 'owner')
      .andWhere('time.fromAt >= :from', { from: new Date(from) })
      .andWhere('time.toAt <= :to', { to: new Date(to) })
      .andWhere('owner.id = :ownerId', { ownerId: freelancer.id })
      .andWhere('project.id = :projectId', { projectId: project.id })
      .andWhere('project.deletedAt IS NULL')
      .andWhere('COALESCE(time.isPaid, false) = false')
      .getMany()
  }

  private applyViewAccessFilter(
    qb: SelectQueryBuilder<unknown>,
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
