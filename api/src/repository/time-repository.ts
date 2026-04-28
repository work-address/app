import _ from 'lodash'
import { inject, injectable } from 'inversify'

import { Filter } from '../service/filter'
import { AbstractRepositoryTemplate } from './abstract-repository-template'
import { Time } from '../entity/time'
import { User } from '../entity/user'
import { Project } from '../entity/project'
import { EProjectState } from '../interface/project'
import { SelectQueryBuilder } from 'typeorm'
import { ISearch, ISearchTime } from '../interface/search'
import { ITimeTotals } from '../interface/time'
import { Calc } from '../service/calc'
import AccessException from '../exception/access-exception'

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
    search: ISearchTime,
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
