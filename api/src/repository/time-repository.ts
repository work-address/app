import _ from 'lodash'
import { inject, injectable } from 'inversify'

import { Filter } from '@/service/filter'
import { AbstractRepositoryTemplate } from '@/repository/abstract-repository-template'
import { Time } from '@/entity/time'
import { User } from '@/entity/user'
import { Project } from '@/entity/project'
import { EProjectState } from '@/model/project'
import { SelectQueryBuilder } from 'typeorm'
import { ISearch } from '@/model/dto/search'
import { ITimeTotals } from '@/model/time'
import { Calc } from '@/service/calc'
import AccessException from '@/exception/access-exception'
import { TimeSearchDto } from '@/model/dto/time'

@injectable()
export class TimeRepository extends AbstractRepositoryTemplate<Time> {
  @inject('Filter')
  protected filter: Filter
  protected target = Time

  public async findOneConfirmUser(time: Time, user: User): Promise<Time> {
    const timeOwner = await this.getRepo()
      .createQueryBuilder('time')
      .innerJoinAndSelect('time.project', 'project')
      .innerJoin('project.user', 'userId')
      .andWhere('time.id = :timeId', { timeId: time.id })
      .andWhere('userId.id = :userId', { userId: user.id })
      .select()
      .getOne()

    const t = timeOwner

    if (!t) {
      throw new AccessException()
    }

    return t
  }

  public async getTotals(
    user: User,
    projectId: string | undefined,
  ): Promise<ITimeTotals[]> {
    const result = await this.getRepo()
      .createQueryBuilder('time')
      .innerJoinAndSelect('time.project', 'project')
      .innerJoinAndSelect('project.user', 'user')
      .andWhere('project.deletedAt IS NULL')
      .andWhere('user.id = :userId', { userId: user.id })
      .select([
        'project.id as projectId',
        'project.rateHour as rateHour',
        'COUNT(time.id) as minutes',
        'SUM(time.minutesActive) as minutesActive',
        'SUM(time.keyboardKeys) as keyboardKeys',
        'SUM(time.mouseKeys) as mouseKeys',
        'SUM(time.mouseDistance) as mouseDistance',
      ])
      .where((qb: SelectQueryBuilder<Time>) => {
        qb.andWhere('project.user.id = :userId', { userId: user.id })

        if (projectId) {
          qb.andWhere('project.id = :projectId', { projectId })
        }
      })
      .groupBy('project.id')
      .orderBy('project.id', 'ASC')
      .getRawMany()

    return result.map((r) => {
      return {
        projectId: r.projectid,
        rateHour: r.ratehour,
        rateTotal: Calc.rateTotal(r.minutes * 10, r.ratehour),
        minutes: Number(r.minutes * 10),
        minutesActive: Number(r.minutesactive),
        keyboardKeys: Number(r.keyboardkeys),
        mouseKeys: Number(r.mousekeys),
        mouseDistance: Number(r.mousedistance),
      }
    })
  }

  public findAndCountPersonal(
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

    const sort = this.filter.buildOrderByCondition('time', s)
    const limit = this.filter.buildLimit(search)

    return this.getRepo()
      .createQueryBuilder('time')
      .innerJoinAndSelect('time.project', 'project')
      .innerJoinAndSelect('project.user', 'user')
      .andWhere('user.id = :userId', { userId: user.id })
      .andWhere(`project.state = :state`, { state: EProjectState.ACTIVE })
      .andWhere('project.deletedAt IS NULL')
      .select()
      .where((qb: SelectQueryBuilder<Time>) => {
        qb.andWhere('project.user.id = :userId', { userId: user.id })

        if ('projectId' in s.filter) {
          qb.andWhere('project.id = :projectId', {
            projectId: s.filter.projectId,
          })
        }
        if ('fromAt' in s.filter) {
          qb.andWhere('time.fromAt >= :fromAt', {
            fromAt: s.filter.fromAt,
          })
        }
        if ('toAt' in s.filter) {
          qb.andWhere('time.toAt <= :toAt', {
            toAt: s.filter.toAt,
          })
        }
        if ('note' in s.filter) {
          qb.andWhere('time.note ILIKE :note', { note: `%${s.filter.note}%` })
        }
        if ('screenshot' in s.filter) {
          qb.andWhere('time.screenshot ILIKE :screenshot', {
            screenshot: `%${s.filter.screenshot}%`,
          })
        }
        if ('keyboardKeysFrom' in s.filter) {
          qb.andWhere('time.keyboardKeys >= :keyboardKeysFrom', {
            keyboardKeysFrom: s.filter.keyboardKeysFrom,
          })
        }
        if ('keyboardKeysTo' in s.filter) {
          qb.andWhere('time.keyboardKeys <= :keyboardKeysTo', {
            keyboardKeysTo: s.filter.keyboardKeysTo,
          })
        }
        if ('minutesActiveFrom' in s.filter) {
          qb.andWhere('time.minutesActive >= :minutesActiveFrom', {
            minutesActiveFrom: s.filter.minutesActiveFrom,
          })
        }
        if ('minutesActiveTo' in s.filter) {
          qb.andWhere('time.minutesActive <= :minutesActiveTo', {
            minutesActiveTo: s.filter.minutesActiveTo,
          })
        }
        if ('mouseKeysFrom' in s.filter) {
          qb.andWhere('time.mouseKeys >= :mouseKeysFrom', {
            mouseKeysFrom: s.filter.mouseKeysFrom,
          })
        }
        if ('mouseKeysTo' in s.filter) {
          qb.andWhere('time.mouseKeys <= :mouseKeysTo', {
            mouseKeysTo: s.filter.mouseKeysTo,
          })
        }
        if ('mouseDistanceFrom' in s.filter) {
          qb.andWhere('time.mouseDistance >= :mouseDistanceFrom', {
            mouseDistanceFrom: s.filter.mouseDistanceFrom,
          })
        }
        if ('mouseDistanceTo' in s.filter) {
          qb.andWhere('time.mouseDistance <= :mouseDistanceTo', {
            mouseDistanceTo: s.filter.mouseDistanceTo,
          })
        }
        if ('withScreenshots' in s.filter) {
          if (s.filter.withScreenshots) {
            qb.andWhere('time.screenshot IS NOT NULL')
            qb.andWhere("time.screenshot != ''")
          } else {
            qb.andWhere("(time.screenshot IS NULL OR time.screenshot = '')")
          }
        }
        if ('withProcesses' in s.filter) {
          if (s.filter.withProcesses) {
            qb.andWhere('time.processes IS NOT NULL')
            qb.andWhere("time.processes::text != '[]'")
          } else {
            qb.andWhere(
              "(time.processes IS NULL OR time.processes::text = '[]')",
            )
          }
        }
      })
      .orderBy(sort)
      .skip(limit * s.page)
      .take(limit)
      .getManyAndCount()
  }

  public findAndCount(search: ISearch): Promise<[Time[], number]> {
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
    const sort = this.filter.buildOrderByCondition('time', s)
    const limit = this.filter.buildLimit(search)

    return this.getRepo()
      .createQueryBuilder('time')
      .select()
      .orderBy(sort)
      .skip(limit * s.page)
      .take(limit)
      .getManyAndCount()
  }

  public findTimeByWorkerOrFail(time: Time, worker: User): Promise<Time> {
    return this.getRepo()
      .createQueryBuilder('time')
      .innerJoinAndSelect('time.project', 'project')
      .innerJoinAndSelect('project.user', 'owner')
      .andWhere('owner.id = :ownerId', { ownerId: worker.id })
      .andWhere('time.id = :timeId', { timeId: time.id })
      .select()
      .getOneOrFail()
  }

  public findAllTimeForProject(project: Project, user: User): Promise<Time[]> {
    return this.getRepo()
      .createQueryBuilder('time')
      .innerJoinAndSelect('time.project', 'project')
      .innerJoinAndSelect('project.user', 'user')
      .andWhere('project.id = :projectId', { projectId: project.id })
      .andWhere('user.id = :userId', { userId: user.id })
      .select('time')
      .orderBy('time.fromAt', 'DESC')
      .getMany()
  }

  public findTimeSingleForProject(
    project: Project,
    from: Date,
    to: Date,
  ): Promise<Time | undefined> {
    return this.getRepo()
      .createQueryBuilder('time')
      .innerJoinAndSelect('time.project', 'project')
      .andWhere('project.id = :projectId', { projectId: project.id })
      .select('time')
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
      .andWhere('time.fromAt >= :from', { from })
      .andWhere('time.toAt <= :to', { to })
      .andWhere('owner.id = :ownerId', { ownerId: freelancer.id })
      .andWhere('project.id = :projectId', { projectId: project.id })
      .andWhere('project.deletedAt IS NULL')
      .getMany()
  }
}
