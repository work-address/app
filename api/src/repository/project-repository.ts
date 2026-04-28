import * as _ from 'lodash'
import { inject, injectable } from 'inversify'
import { SelectQueryBuilder } from 'typeorm'

import { Filter } from '../service/filter'
import { AbstractRepositoryTemplate } from './abstract-repository-template'
import { Project } from '../entity/project'
import { ISearchProject } from '../interface/search'
import { User } from '../entity/user'
import { EProjectState } from '../interface/project'

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
    search: ISearchProject,
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
      .select()
      .where((qb: SelectQueryBuilder<Project>) => {
        qb.andWhere('project.user.id = :userId', { userId: user.id })

        if ('state' in s.filter) {
          qb.andWhere('project.state = :state', { state: s.filter.state })
        }
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
}
