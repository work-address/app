import { injectable } from 'inversify'

import { AbstractRepositoryTemplate } from '@/repository/abstract-repository-template'
import { ProjectStatistics } from '@/entity/project-statistics'
import { Project } from '@/entity/project'
import { EProjectStatisticsPeriod } from '@/model/project-statistics'

@injectable()
export class ProjectStatisticsRepository extends AbstractRepositoryTemplate<ProjectStatistics> {
  protected target = ProjectStatistics

  public findAllForProjectAndPeriod(
    project: Project,
    period: EProjectStatisticsPeriod,
  ): Promise<ProjectStatistics[]> {
    return this.getRepo()
      .createQueryBuilder('statistics')
      .innerJoin('statistics.project', 'project')
      .andWhere('project.id = :projectId', { projectId: project.id })
      .andWhere('statistics.period = :period', { period })
      .orderBy('statistics.timeMin', 'DESC')
      .getMany()
  }

  public findAllForProject(project: Project): Promise<ProjectStatistics[]> {
    return this.getRepo()
      .createQueryBuilder('statistics')
      .innerJoin('statistics.project', 'project')
      .andWhere('project.id = :projectId', { projectId: project.id })
      .orderBy('statistics.period', 'ASC')
      .addOrderBy('statistics.timeMin', 'DESC')
      .getMany()
  }

  public async deleteForProjectAndPeriod(
    project: Project,
    period: EProjectStatisticsPeriod,
  ): Promise<void> {
    await this.getRepo()
      .createQueryBuilder()
      .delete()
      .from(ProjectStatistics)
      .where('projectId = :projectId', { projectId: project.id })
      .andWhere('period = :period', { period })
      .execute()
  }
}
