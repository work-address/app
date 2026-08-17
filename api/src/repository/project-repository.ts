import * as _ from 'lodash'
import { inject, injectable } from 'inversify'
import { Brackets, SelectQueryBuilder } from 'typeorm'

import { Filter } from '@/service/filter'
import { AbstractRepositoryTemplate } from '@/repository/abstract-repository-template'
import { Project } from '@/entity/project'
import { User } from '@/entity/user'
import { EProjectState } from '@/model/project'
import { ProjectSearchDto } from '@/model/dto/project'
import { UserRepository } from '@/repository/user-repository'

@injectable()
export class ProjectRepository extends AbstractRepositoryTemplate<Project> {
  @inject('Filter')
  protected filter: Filter
  @inject('UserRepository')
  protected userRepository: UserRepository
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

  public async findProjectWithAccess(
    project: Project,
    user: User,
  ): Promise<Project | undefined> {
    const qb = this.getRepo()
      .createQueryBuilder('project')
      .innerJoinAndSelect('project.user', 'owner')
      .where('project.id = :projectId', { projectId: project.id })

    this.applyViewAccessFilter(qb, 'owner', user)

    const found = await qb.getOne()
    if (!found) {
      return undefined
    }

    return this.attachAccessUsers(found)
  }

  public findProjectForTimeTracking(id: string, user: User): Promise<Project> {
    const qb = this.getRepo()
      .createQueryBuilder('project')
      .innerJoinAndSelect('project.user', 'owner')
      .where('project.id = :id', { id })
      .andWhere('project.state = :state', { state: EProjectState.ACTIVE })

    this.applyWorkerAccessFilter(qb, 'owner', user)

    return qb.getOneOrFail()
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

    const [projects, count] = await this.getRepo()
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.user', 'user')
      .select()
      .where((qb: SelectQueryBuilder<Project>) => {
        this.applyViewAccessFilter(qb, 'user', user)

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

    await this.attachAccessUsersToProjects(projects)

    return [projects, count]
  }

  private async attachAccessUsers(project: Project): Promise<Project> {
    await this.attachAccessUsersToProjects([project])
    return project
  }

  private async attachAccessUsersToProjects(
    projects: Project[],
  ): Promise<void> {
    if (!projects.length) {
      return
    }

    const addresses = [
      ...new Set(
        projects.flatMap((project) => [
          ...(project.workerAddresses ?? []),
          ...(project.viewerAddresses ?? []),
        ]),
      ),
    ]

    if (!addresses.length) {
      for (const project of projects) {
        project.workers = []
        project.viewers = []
      }
      return
    }

    const users = await this.userRepository.findByAddresses(addresses)
    const usersByAddress = new Map(
      users.map((u) => [u.address.toLowerCase(), u]),
    )

    for (const project of projects) {
      const workerAddresses = project.workerAddresses ?? []
      const viewerAddresses = project.viewerAddresses ?? []

      project.workers = workerAddresses
        .map((address) => usersByAddress.get(address.toLowerCase()))
        .filter((u): u is User => u !== undefined)
      project.viewers = viewerAddresses
        .map((address) => usersByAddress.get(address.toLowerCase()))
        .filter((u): u is User => u !== undefined)
    }
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

  private applyWorkerAccessFilter(
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
      }),
    )
  }
}
