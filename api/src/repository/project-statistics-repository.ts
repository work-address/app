import { injectable } from 'inversify'

import {
  AbstractRepositoryTemplate,
  RepoEffect,
} from '@/repository/abstract-repository-template'
import { fromPromise } from '@/service/effect-bridge'
import { ProjectStatistics } from '@/entity/project-statistics'
import { Project } from '@/entity/project'
import { EProjectStatisticsPeriod } from '@/model/project-statistics'

@injectable()
export class ProjectStatisticsRepository extends AbstractRepositoryTemplate<ProjectStatistics> {
  protected target = ProjectStatistics

  public findAllForProjectAndPeriod(
    project: Project,
    period: EProjectStatisticsPeriod,
  ): RepoEffect<ProjectStatistics[]> {
    return fromPromise(() =>
      this.getRepo()
        .createQueryBuilder('statistics')
        .innerJoin('statistics.project', 'project')
        .andWhere('project.id = :projectId', { projectId: project.id })
        .andWhere('statistics.period = :period', { period })
        .orderBy('statistics.timeMin', 'DESC')
        .getMany(),
    )
  }

  public findAllForProject(project: Project): RepoEffect<ProjectStatistics[]> {
    return fromPromise(() =>
      this.getRepo()
        .createQueryBuilder('statistics')
        .innerJoin('statistics.project', 'project')
        .andWhere('project.id = :projectId', { projectId: project.id })
        .orderBy('statistics.period', 'ASC')
        .addOrderBy('statistics.timeMin', 'DESC')
        .getMany(),
    )
  }

  public deleteForProjectAndPeriod(
    project: Project,
    period: EProjectStatisticsPeriod,
  ): RepoEffect<void> {
    return fromPromise(async () => {
      await this.getRepo()
        .createQueryBuilder()
        .delete()
        .from(ProjectStatistics)
        .where('projectId = :projectId', { projectId: project.id })
        .andWhere('period = :period', { period })
        .execute()
    })
  }
}
