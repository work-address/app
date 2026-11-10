import { Effect } from 'effect'
import * as _ from 'lodash'
import { inject, injectable } from 'inversify'
import { OrderByCondition, SelectQueryBuilder } from 'typeorm'

import { Filter } from '@/service/filter'
import {
  AbstractRepositoryTemplate,
  RepoEffect,
} from '@/repository/abstract-repository-template'
import { fromPromise } from '@/service/effect-bridge'
import { Project } from '@/entity/project'
import { User } from '@/entity/user'
import AccessException from '@/exception/access-exception'
import ProjectUnavailableException from '@/exception/project-unavailable-exception'
import { EProjectState } from '@/model/project'
import { ProjectSearchDto } from '@/model/dto/project'
import { Plan } from '@/service/plan'
import { Collaborators } from '@/service/collaborators'
import { ProjectAccess } from '@/service/project-access'
import { WorkerAgents } from '@/service/worker-agents'

/** Every order the project list can ask for, by the name it asks with. */
const PROJECT_SORT_COLUMN_BY_KEY = new Map([
  ['id', 'project.id'],
  ['createdAt', 'project.createdAt'],
  ['updatedAt', 'project.updatedAt'],
  ['title', 'project.title'],
  ['state', 'project.state'],
  ['rateHour', 'project.rateHour'],
  ['trackScreenshots', 'project.trackScreenshots'],
  ['trackProcesses', 'project.trackProcesses'],
])

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

@injectable()
export class ProjectRepository extends AbstractRepositoryTemplate<Project> {
  @inject('Filter')
  protected filter: Filter
  @inject('ProjectAccess')
  protected access: ProjectAccess
  @inject('Plan')
  protected plan: Plan
  @inject('Collaborators')
  protected collaborators: Collaborators
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

    this.access.filterProjects(
      qb,
      { project: 'project', owner: 'owner' },
      user,
      'viewer',
    )

    return Effect.gen(this, function* () {
      const found = yield* fromPromise(() => qb.getOne())

      if (!found) {
        return undefined
      }

      this.presentTo(found, user)
      return yield* this.attachAccessUsers(found)
    })
  }

  /**
   * `findProjectWithAccess` with the guard its callers were all repeating:
   * no visible project means 403, stated once in the type instead of as an
   * `if (!accessible) throw` after every call.
   */
  /** Every live project the user owns, works on or views. */
  public findAllWithAccess(user: User): RepoEffect<Project[]> {
    const qb = this.getRepo()
      .createQueryBuilder('project')
      .innerJoinAndSelect('project.user', 'owner')
      .where('project.deletedAt IS NULL')

    this.access.filterProjects(
      qb,
      { project: 'project', owner: 'owner' },
      user,
      'viewer',
    )

    return Effect.gen(this, function* () {
      const projects = yield* fromPromise(() => qb.getMany())

      yield* this.attachAccessUsersToProjects(projects)
      for (const project of projects) {
        this.presentTo(project, user)
      }
      return projects
    })
  }

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
    // A malformed id is refused like any unavailable project instead of
    // reaching Postgres as a query error a client would retry forever.
    if (!UUID_PATTERN.test(String(id ?? '')))
      return Effect.fail(new ProjectUnavailableException())
    const qb = this.getRepo()
      .createQueryBuilder('project')
      .innerJoinAndSelect('project.user', 'owner')
      .where('project.id = :id', { id })
      .andWhere('project.state = :state', { state: EProjectState.ACTIVE })

    this.access.filterProjects(
      qb,
      { project: 'project', owner: 'owner' },
      user,
      'worker',
    )

    return fromPromise(() => qb.getOne()).pipe(
      Effect.flatMap((project) =>
        project
          ? Effect.succeed(project)
          : Effect.fail(new ProjectUnavailableException()),
      ),
    )
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

  /** The order to run, sorting the rate by what this reader may see of it. */
  private buildVisibleOrderBy(
    query: SelectQueryBuilder<Project>,
    search: ProjectSearchDto,
    user: User,
  ): OrderByCondition {
    const sort = this.filter.buildOrderByCondition(
      PROJECT_SORT_COLUMN_BY_KEY,
      search,
      'projects',
    )
    const direction = sort['project.rateHour']

    if (!direction) {
      return sort
    }

    this.access.selectVisibleRate(
      query,
      { project: 'project', owner: 'user' },
      user,
      'visible_rate_sort',
    )

    return { visible_rate_sort: direction, 'project.id': 'ASC' }
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
    const limit = this.filter.buildLimit(search)

    const query = this.getRepo()
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.user', 'user')
      .select()
      .where((qb: SelectQueryBuilder<Project>) => {
        this.access.filterProjects(
          qb,
          { project: 'project', owner: 'user' },
          user,
          'viewer',
        )

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
        // Filtering by rate would read it back through which projects match.
        if ('rateHourFrom' in s.filter || 'rateHourTo' in s.filter) {
          this.access.filterProjects(
            qb,
            { project: 'project', owner: 'user' },
            user,
            'worker',
          )
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
      .skip(limit * s.page)
      .take(limit)

    return Effect.gen(this, function* () {
      const [projects, count] = yield* fromPromise(() =>
        query
          .orderBy(this.buildVisibleOrderBy(query, s, user))
          .getManyAndCount(),
      )

      for (const project of projects) {
        this.presentTo(project, user)
        // Whether this user's time uploads to it are accepted: what
        // findProjectForTimeTracking checks. A tracker offers only these,
        // since the list also holds closed projects and viewer-only ones.
        project.canTrack =
          project.state === EProjectState.ACTIVE &&
          (yield* fromPromise(() => this.plan.mayTrack(project, user)))
      }
      yield* this.attachAccessUsersToProjects(projects)

      return [projects, count] as [Project[], number]
    })
  }

  /** The reader's role on a project, and what that role may not see of it. */
  private presentTo(project: Project, user: User): void {
    project.role = this.access.role(project, user)
    project.agents = WorkerAgents.visibleTo(project.agentAttachments ?? [], {
      id: user.id,
      isOwner: project.isOwner(user),
      canWork: this.access.canWork(project, user),
    })
    // A viewer gets time and no money: SPEC.md, "Who can see what".
    if (project.role === 'viewer') {
      delete (project as Partial<Project>).rateHour
    }
  }

  private attachAccessUsers(project: Project): RepoEffect<Project> {
    return this.attachAccessUsersToProjects([project]).pipe(Effect.as(project))
  }

  private attachAccessUsersToProjects(projects: Project[]): RepoEffect<void> {
    return fromPromise(async () => {
      const people = await this.collaborators.of(projects)

      for (const project of projects) {
        const signedIn = (role: 'worker' | 'viewer') =>
          (people.get(project.id) ?? []).flatMap((person) =>
            person.role === role && person.account ? [person.account] : [],
          )

        project.workers = signedIn('worker')
        project.viewers = signedIn('viewer')
      }
    })
  }
}
