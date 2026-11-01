import { User } from '@/entity/user'
import { StatisticsManager } from '@/service/statistics-manager'
import { fromPromise } from '@/service/effect-bridge'
import { inject, injectable } from 'inversify'
import moment from 'moment'

import { Project } from '@/entity/project'
import { ProjectStatistics } from '@/entity/project-statistics'
import {
  EProjectStatisticsPeriod,
  IProjectStatisticsPeriodConfig,
} from '@/model/project-statistics'
import { RepoEffect } from '@/repository/abstract-repository-template'
import { BadRequestError } from 'routing-controllers'

@injectable()
export class ProjectStatisticsManager {
  @inject('StatisticsManager') private statistics: StatisticsManager

  /** Compatibility shape for older clients; never serve the unscoped cache. */
  public getScopedStatsForProject(
    project: Project,
    period: EProjectStatisticsPeriod,
    user: User,
  ): RepoEffect<ProjectStatistics[]> {
    return fromPromise(async () => {
      const config = this.periodConfig[period]
      if (!config) throw new BadRequestError('Invalid statistics period')
      const result = await this.statistics.read(
        'ranking',
        {
          projectIds: [project.id],
          from: moment
            .utc()
            .subtract(config.windowAmount, config.windowUnit)
            .format('YYYY-MM-DD'),
          to: moment.utc().add(1, 'day').format('YYYY-MM-DD'),
          timeZone: 'UTC',
        },
        user,
      )
      return (result.rows ?? []).map((row) =>
        Object.assign(new ProjectStatistics(), {
          project,
          period,
          processName: row.app,
          timeMin: Number(row.seconds) / 60,
        }),
      )
    })
  }

  protected isPeriodStale(
    rows: ProjectStatistics[],
    period: EProjectStatisticsPeriod,
  ): boolean {
    const config = this.periodConfig[period]
    const refreshInterval = moment.duration(
      config.refreshAmount,
      config.refreshUnit,
    )
    const latestUpdatedAt = rows.reduce((latest, row) => {
      const updatedAt = moment(row.updatedAt)

      return updatedAt.isAfter(latest) ? updatedAt : latest
    }, moment(rows[0].updatedAt))

    return moment().diff(latestUpdatedAt) >= refreshInterval.asMilliseconds()
  }

  private periodConfig: Record<
    EProjectStatisticsPeriod,
    IProjectStatisticsPeriodConfig
  > = {
    [EProjectStatisticsPeriod.ONE_DAY]: {
      windowAmount: 1,
      windowUnit: 'day',
      refreshAmount: 1,
      refreshUnit: 'hour',
    },
    [EProjectStatisticsPeriod.SEVEN_DAYS]: {
      windowAmount: 7,
      windowUnit: 'days',
      refreshAmount: 1,
      refreshUnit: 'day',
    },
    [EProjectStatisticsPeriod.ONE_WEEK]: {
      windowAmount: 1,
      windowUnit: 'week',
      refreshAmount: 1,
      refreshUnit: 'day',
    },
    [EProjectStatisticsPeriod.ONE_MONTH]: {
      windowAmount: 1,
      windowUnit: 'month',
      refreshAmount: 1,
      refreshUnit: 'week',
    },
    [EProjectStatisticsPeriod.SIX_MONTHS]: {
      windowAmount: 6,
      windowUnit: 'months',
      refreshAmount: 1,
      refreshUnit: 'week',
    },
    [EProjectStatisticsPeriod.ONE_YEAR]: {
      windowAmount: 1,
      windowUnit: 'year',
      refreshAmount: 1,
      refreshUnit: 'month',
    },
  }
}
