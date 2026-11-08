import { inject, injectable } from 'inversify'
import { getDataSource } from '@/connector/data-source'
import { Project } from '@/entity/project'
import { User } from '@/entity/user'
import { UserRepository } from '@/repository/user-repository'
import { runPromise } from '@/service/effect-bridge'
import { ProjectAccess } from '@/service/project-access'

/** The rows the Team page is made of. What each reader sees is `TeamManager`. */
@injectable()
export class TeamRepository {
  @inject('ProjectAccess') private access: ProjectAccess
  @inject('UserRepository') private users: UserRepository

  /** The projects `user` has at least `atLeast` on today, with their owners. */
  public projects(
    user: User,
    atLeast: 'worker' | 'viewer',
  ): Promise<Project[]> {
    const query = getDataSource()
      .getRepository(Project)
      .createQueryBuilder('project')
      .innerJoinAndSelect('project.user', 'owner')
      .orderBy('project.title', 'ASC')
      .addOrderBy('project.id', 'ASC')
    this.access.filterProjects(
      query,
      { project: 'project', owner: 'owner' },
      user,
      atLeast,
    )
    return query.getMany()
  }

  /** The accounts behind these list entries; entries with none are left out. */
  public accounts(addresses: string[]): Promise<User[]> {
    return runPromise(this.users.findByAddresses(addresses))
  }
}
