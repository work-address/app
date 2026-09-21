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
import { WalletAddress } from '@/service/wallet-address'
import { User } from '@/entity/user'
import AccessException from '@/exception/access-exception'
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

  /**
   * Every live project that has stated an invoicing cadence.
   *
   * The scheduler's entry point, so it reads the whole set rather than one
   * person's: a project with no cadence has nothing to issue, and a closed or
   * deleted one has nobody left to bill. The owner is joined because issuing
   * needs their address for the invoice's snapshot.
   */
  public findWithInvoiceCadence(): RepoEffect<Project[]> {
    return fromPromise(() =>
      this.getRepo()
        .createQueryBuilder('project')
        .innerJoinAndSelect('project.user', 'owner')
        .andWhere('project.deletedAt IS NULL')
        .andWhere('project.state = :state', { state: EProjectState.ACTIVE })
        .andWhere('project."invoiceCadence" IS NOT NULL')
        .andWhere(`jsonb_array_length(project."invoiceCadence") > 0`)
        .orderBy('project.createdAt', 'ASC')
        .getMany(),
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
      // Keyed on the canonical form, which is what `isSame` compares: an EVM
      // entry finds its account whatever its casing, and a Solana entry only
      // the account spelled exactly that way.
      const usersByAddress = new Map(
        users.map((u) => [WalletAddress.toCanonical(u.address), u]),
      )
      const resolve = (entries: string[]): User[] =>
        entries
          .map((address) =>
            usersByAddress.get(WalletAddress.toCanonical(address)),
          )
          .filter((u): u is User => u !== undefined)

      for (const project of projects) {
        project.workers = resolve(project.workerAddresses ?? [])
        project.viewers = resolve(project.viewerAddresses ?? [])
      }
    })
  }

  /**
   * The owner, or anyone whose address is on the worker or viewer list.
   *
   * Membership alone decides it: collaborators are free, so the owner's plan
   * is not part of the predicate. Mirrors Project.isViewer.
   */
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

  /** The owner, or a worker on the project. Mirrors Project.isWorker. */
  private applyWorkerAccessFilter(
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
      }),
    )
  }
}
