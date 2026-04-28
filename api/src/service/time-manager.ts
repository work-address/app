import { inject, injectable } from 'inversify'
import moment from 'moment'

import { Time } from '@/entity/time'
import { User } from '@/entity/user'
import { TimeRepository } from '@/repository/time-repository'
import { ProjectRepository } from '@/repository/project-repository'
import { ITimeInsertionResult } from '@/interface/time'
import { ErrorFormatter } from '@/service/error-formatter'
import { TimeCreateDto } from '@/validator/dto/time-create-dto'
import { Project } from '@/entity/project'
import { RedisClient } from '@/service/redis-client'
import { ITimeTotals } from '@/interface/time'
import { EProjectState } from '@/interface/project'
import AccessException from '@/exception/access-exception'
import { ImageResizer } from '@/service/image-resizer'

@injectable()
export class TimeManager {
  @inject('TimeRepository')
  protected timeRepository: TimeRepository
  @inject('ProjectRepository')
  protected projectRepository: ProjectRepository
  @inject('RedisClient')
  protected redisClient: RedisClient
  @inject('ImageResizer')
  protected imageResizer: ImageResizer

  public static reportExpiresIn: number = 1000 * 60 * 10 // 10 minutes

  public async createOrUpdateMany(
    data: TimeCreateDto[],
    user: User,
  ): Promise<ITimeInsertionResult[]> {
    const insertionResults: ITimeInsertionResult[] = []

    for (let a = 0; a < data.length; a++) {
      const item = data[a]
      const fromAt = moment(item.fromAt).toDate()
      const toAt = moment(item.toAt).toDate()

      try {
        const project = await this.projectRepository.findProjectAsWorkerOrFail(
          item.projectId,
        )

        const isAccessible =
          project.user.id === user.id && project.state === EProjectState.ACTIVE

        if (!isAccessible) {
          throw new AccessException(
            `The given project is unavailable for time tracking`,
          )
        }

        let time = await this.timeRepository.findTimeSingleForProject(
          project,
          fromAt,
          toAt,
        )

        if (!time) {
          time = new Time()
        }

        time.fromAt = fromAt
        time.toAt = toAt
        time.note = item.note
        time.minutesActive = item.minutesActive
        time.keyboardKeys = item.keyboardKeys
        time.mouseKeys = item.mouseKeys
        time.mouseDistance = item.mouseDistance
        time.project = project
        time.screenshot = await this.resize(item.screenshot)
        time.processes = item.processes

        const savedTime = await this.timeRepository.validateAndSave(time)

        insertionResults.push({
          ...item,
          id: savedTime.id,
          screenshot: undefined,
          processes: undefined,
        })
      } catch (error: any) {
        insertionResults.push({
          ...item,
          error: ErrorFormatter.format(error),
          screenshot: undefined,
          processes: undefined,
        })
      }
    }

    return insertionResults
  }

  public async save(time: Time): Promise<Time> {
    return this.timeRepository.validateAndSave(time)
  }

  public async editAndSave(time: Time, data: Time, worker: User) {
    const timeExisting = await this.timeRepository.findTimeByWorkerOrFail(
      time,
      worker,
    )

    if (!timeExisting) {
      throw new AccessException(`The given time belongs to someone else`)
    }

    time = Object.assign(time, data)

    await this.timeRepository.validateAndSave(time)
  }

  public async remove(time: Time, worker: User) {
    const timeExisting = await this.timeRepository.findTimeByWorkerOrFail(
      time,
      worker,
    )

    if (!timeExisting) {
      throw new AccessException(
        `Wrong user: the given time belongs to someone else`,
      )
    }

    await this.timeRepository.remove(timeExisting)
  }

  public async buildAndCacheReport(
    project: Project,
    user: User,
  ): Promise<{
    totals: ITimeTotals[]
    time: Time[]
  }> {
    const data = {
      totals: await this.timeRepository.getTotals(user, project.id),
      time: await this.timeRepository.findAllTimeForProject(project, user),
    }

    const cache = await this.redisClient.get(project.id)

    if (cache) {
      return cache
    }

    await this.redisClient.setWithExpiry(
      project.id,
      data,
      TimeManager.reportExpiresIn,
    )

    return data
  }

  public async resize(screenshot?: string): Promise<string | null> {
    if (!screenshot) {
      return null
    }

    return this.imageResizer.resize(screenshot, 600)
  }
}
