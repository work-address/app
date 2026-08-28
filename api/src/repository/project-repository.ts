import { Effect } from 'effect'
import * as _ from 'lodash'
import { inject, injectable } from 'inversify'
import { Brackets, ObjectLiteral, SelectQueryBuilder } from 'typeorm'

import { Filter } from '@/service/filter'
import {
  AbstractRepositoryTemplate,
  RepoEffect,
} from '@/repository/abstract-repository-template'
import { fromPromise } from '@/service/effect-bridge'
import { Project } from '@/entity/project'
import { User } from '@/entity/user'
import AccessException from '@/exception/access-exception'
import { EProjectState } from '@/model/project'
import { ProjectSearchDto } from '@/model/dto/project'
import { UserRepository } from '@/repository/user-repository'
import { Entitlement } from '@/service/entitlement'

@injectable()
export class ProjectRepository extends AbstractRepositoryTemplate<Project> {
  @inject('Filter')
  protected filter: Filter
  @inject('UserRepository')
  protected userRepository: UserRepository
  @inject('Entitlement')
  protected entitlement: Entitlement
  protected target = Project

  public findProjectAsOwner(
    project: Project,
    user: User,
  ): RepoEffect<Project | undefined> {
    return fromPromise(
      async () =>
        (await this.getRepo()
          .createQueryBuilder('project')
          .innerJoinAndSelect('project.user', 'user')
          .andWhere('project.id = :projectId', { projectId: project.id })
          .andWhere('user.id = :userId', { userId: user.id })
          .select()
          .getOne()) ?? undefined,
    )
  }

  public findProjectWithAccess(
    project: Project,
    user: User,
  ): RepoEffect<Project | undefined> {
    const qb = this.getRepo()
      .createQueryBuilder('project')
      .innerJoinAndSelect('project.user', 'owner')
      .where('project.id = :projectId', { projectId: project.id })

    this.applyViewAccessFilter(qb, 'owner', user)

    return Effect.gen(this, function* () {
      const found = yield* fromPromise(() => qb.getOne())

      if (!found) {
        return undefined
      }

      return yield* this.attachAccessUsers(found)
    })
  }

  /**
   * `findProjectWithAccess` with the guard its callers were all repeating:
   * no visible project means 403, stated once in the type instead of as an
   * `if (!accessible) throw` after every call.
   */
  public findProjectWithAccessOrFail(
    project: Project,
    user: User,
  ): RepoEffect<Project> {
    return this.findProjectWithAccess(project, user).pipe(
      Effect.filterOrFail(
        (accessible): accessible is Project => accessible !== undefined,
        () => new AccessException(),
      ),
    )
  }

  public findProjectForTimeTracking(
    id: string,
    user: User,
  ): RepoEffect<Project> {
    const qb = this.getRepo()
      .createQueryBuilder('project')
      .innerJoinAndSelect('project.user', 'owner')
      .where('project.id = :id', { id })
      .andWhere('project.state = :state', { state: EProjectState.ACTIVE })

    this.applyWorkerAccessFilter(qb, 'owner', user)

    return fromPromise(() => qb.getOneOrFail())
  }

  public findProjectOwnedBy(
    project: Project,
    user: User,
  ): RepoEffect<Project | undefined> {
    return fromPromise(
      async () =>
        (await this.getRepo()
          .createQueryBuilder('project')
          .innerJoinAndSelect('project.user', 'owner')
          .andWhere('project.id = :id', { id: project.id })
          .andWhere('owner.id = :userId', { userId: user.id })
          .getOne()) ?? undefined,
    )
  }

  public findAndCountAccessibleBy(
    search: ProjectSearchDto,
    user: User,
  ): RepoEffect<[Project[], number]> {
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

    const query = this.getRepo()
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

    return Effect.gen(this, function* () {
      const [projects, count] = yield* fromPromise(() =>
        query.getManyAndCount(),
      )

      yield* this.attachAccessUsersToProjects(projects)

      return [projects, count] as [Project[], number]
    })
  }

  private attachAccessUsers(project: Project): RepoEffect<Project> {
    return this.attachAccessUsersToProjects([project]).pipe(Effect.as(project))
  }

  private attachAccessUsersToProjects(projects: Project[]): RepoEffect<void> {
    return Effect.gen(this, function* () {
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

      const users = yield* this.userRepository.findByAddresses(addresses)
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
    })
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
            new Brackets((collaboratorQb) => {
              const addresses = new Brackets((addressQb) => {
                addressQb
                  .where(
                    `:userAddress = ANY(SELECT lower(address) FROM unnest(COALESCE(project.workerAddresses, '{}')) AS address)`,
                    { userAddress },
                  )
                  .orWhere(
                    `:userAddress = ANY(SELECT lower(address) FROM unnest(COALESCE(project.viewerAddresses, '{}')) AS address)`,
                    { userAddress },
                  )
              })

              // Self-hosted instances omit the predicate rather than relying on
              // column data - see Entitlement.shouldFilterByPremium.
              if (this.entitlement.shouldFilterByPremium()) {
                collaboratorQb
                  .where(`${ownerAlias}.premium = true`)
                  .andWhere(addresses)
              } else {
                collaboratorQb.where(addresses)
              }
            }),
          )
      }),
    )
  }

  private applyWorkerAccessFilter(
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
            new Brackets((collaboratorQb) => {
              const isWorkerAddress = `:userAddress = ANY(SELECT lower(address) FROM unnest(COALESCE(project.workerAddresses, '{}')) AS address)`

              if (this.entitlement.shouldFilterByPremium()) {
                collaboratorQb
                  .where(`${ownerAlias}.premium = true`)
                  .andWhere(isWorkerAddress, { userAddress })
              } else {
                collaboratorQb.where(isWorkerAddress, { userAddress })
              }
            }),
          )
      }),
    )
  }
}
