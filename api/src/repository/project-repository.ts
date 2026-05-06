import * as _ from 'lodash'
import { inject, injectable } from 'inversify'
import { SelectQueryBuilder } from 'typeorm'

import { Filter } from '@/service/filter'
import { AbstractRepositoryTemplate } from '@/repository/abstract-repository-template'
import { Project } from '@/entity/project'
import { User } from '@/entity/user'
import { EProjectState } from '@/model/project'
import { ProjectSearchDto } from '@/model/dto/project'

@injectable()
export class ProjectRepository extends AbstractRepositoryTemplate<Project> {
  @inject('Filter')
  protected filter: Filter
  protected target = Project

  public findProjectAsOwner(
    project: Project,
    user: User,
  ): Promise<Project | undefined> {
    return this.getRepo()
      .createQueryBuilder('project')
      .innerJoinAndSelect('project.user', 'user')
      .andWhere('project.id = :projectId', { projectId: project.id })
      .andWhere('user.id = :userId', { userId: user.id })
      .select()
      .getOne()
  }

  public findProjectAsWorkerOrFail(id: string): Promise<Project> {
    return this.getRepo()
      .createQueryBuilder('project')
      .innerJoinAndSelect('project.user', 'user')
      .andWhere('project.id = :id', { id })
      .andWhere(`project.state IN (:...state)`, {
        state: [EProjectState.ACTIVE],
      })
      .select()
      .getOneOrFail()
  }

  public findProjectOwnedBy(
    project: Project,
    user: User,
  ): Promise<Project | undefined> {
    return this.getRepo()
      .createQueryBuilder('project')
      .innerJoinAndSelect('project.user', 'owner')
      .andWhere('project.id = :id', { id: project.id })
      .andWhere('owner.id = :userId', { userId: user.id })
      .getOne()
  }

  public async findAndCountAccessibleBy(
    search: ProjectSearchDto,
    user: User,
  ): Promise<[Project[], number]> {
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
    const sort = this.filter.buildOrderByCondition('project', s)
    const limit = this.filter.buildLimit(search)

    return this.getRepo()
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.user', 'user')
      .select()
      .where((qb: SelectQueryBuilder<Project>) => {
        qb.andWhere('user.id = :userId', { userId: user.id })

        if ('userId' in s.filter) {
          qb.andWhere('user.id = :ownerId', {
            ownerId: s.filter.userId,
          })
        }
        if ('state' in s.filter) {
          qb.andWhere('project.state = :state', { state: s.filter.state })
        }
        if ('projectId' in s.filter) {
          qb.andWhere('project.id = :projectId', {
            projectId: s.filter.projectId,
          })
        }
        if ('title' in s.filter) {
          qb.andWhere('project.title ILIKE :title', {
            title: `%${s.filter.title}%`,
          })
        }
        if ('text' in s.filter) {
          qb.andWhere('project.text ILIKE :text', {
            text: `%${s.filter.text}%`,
          })
        }
        if ('rateHourFrom' in s.filter) {
          qb.andWhere('project.rateHour >= :rateHourFrom', {
            rateHourFrom: s.filter.rateHourFrom,
          })
        }
        if ('rateHourTo' in s.filter) {
          qb.andWhere('project.rateHour <= :rateHourTo', {
            rateHourTo: s.filter.rateHourTo,
          })
        }
        if ('trackScreenshots' in s.filter) {
          qb.andWhere('project.trackScreenshots = :trackScreenshots', {
            trackScreenshots: s.filter.trackScreenshots,
          })
        }
        if ('trackProcesses' in s.filter) {
          qb.andWhere('project.trackProcesses = :trackProcesses', {
            trackProcesses: s.filter.trackProcesses,
          })
        }
        if ('withScreenshots' in s.filter) {
          qb.andWhere('project.trackScreenshots = :withScreenshots', {
            withScreenshots: s.filter.withScreenshots,
          })
        }
        if ('withProcesses' in s.filter) {
          qb.andWhere('project.trackProcesses = :withProcesses', {
            withProcesses: s.filter.withProcesses,
          })
        }
      })
      .orderBy(sort)
      .skip(limit * s.page)
      .take(limit)
      .getManyAndCount()
  }
}
