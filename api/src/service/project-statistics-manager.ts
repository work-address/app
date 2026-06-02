import { inject, injectable } from 'inversify'
import moment from 'moment'

import { Project } from '@/entity/project'
import { ProjectStatistics } from '@/entity/project-statistics'
import { Time } from '@/entity/time'
import {
  EProjectStatisticsPeriod,
  IProjectStatisticsPeriodConfig,
} from '@/model/project-statistics'
import { ProjectStatisticsRepository } from '@/repository/project-statistics-repository'
import { TimeRepository } from '@/repository/time-repository'
import { BadRequestError } from 'routing-controllers'

@injectable()
export class ProjectStatisticsManager {
  @inject('ProjectStatisticsRepository')
  protected projectStatisticsRepository: ProjectStatisticsRepository
  @inject('TimeRepository')
  protected timeRepository: TimeRepository

  public async getStatsForProject(
    project: Project,
    period: EProjectStatisticsPeriod,
  ): Promise<ProjectStatistics[]> {
    if (!Object.values(EProjectStatisticsPeriod).includes(period)) {
      throw new BadRequestError(`Invalid statistics period: ${period}`)
    }

    let rows =
      await this.projectStatisticsRepository.findAllForProjectAndPeriod(
        project,
        period,
      )

    if (!rows.length || this.isPeriodStale(rows, period)) {
      rows = await this.aggregateAndSave(project, period)
    }

    return rows
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

  private aggregateProcessesFromTimes(
    times: Time[],
  ): Pick<ProjectStatistics, 'processName' | 'timeMin'>[] {
    const byName = new Map<string, number>()

    for (const time of times) {
      if (!time.processes?.length) {
        continue
      }

      for (const process of time.processes) {
        byName.set(
          process.name,
          (byName.get(process.name) ?? 0) + process.timeMin,
        )
      }
    }

    return [...byName.entries()]
      .map(([processName, timeMin]) => ({ processName, timeMin }))
      .sort((a, b) => b.timeMin - a.timeMin)
  }

  private async aggregateAndSave(
    project: Project,
    period: EProjectStatisticsPeriod,
  ): Promise<ProjectStatistics[]> {
    const config = this.periodConfig[period]

    const fromAt = moment()
      .subtract(config.windowAmount, config.windowUnit)
      .toDate()

    const times = await this.timeRepository.findWithProcessesForProjectSince(
      project,
      fromAt,
    )
    const processes = this.aggregateProcessesFromTimes(times)

    await this.projectStatisticsRepository.deleteForProjectAndPeriod(
      project,
      period,
    )

    if (!processes.length) {
      return []
    }

    const rows = processes.map((process) => {
      const statistics = new ProjectStatistics()
      statistics.project = project
      statistics.period = period
      statistics.processName = process.processName
      statistics.timeMin = process.timeMin

      return statistics
    })

    return this.projectStatisticsRepository.saveMany(rows)
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
