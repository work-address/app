import { inject, injectable } from 'inversify'
import moment from 'moment'

import { Time } from '@/entity/time'
import { User } from '@/entity/user'
import { TimeRepository } from '@/repository/time-repository'
import { ProjectRepository } from '@/repository/project-repository'
import { ITimeInsertionResult } from '@/model/time'
import { ErrorFormatter } from '@/service/error-formatter'
import { TimeCreateDto } from '@/model/dto/time'
import { Project } from '@/entity/project'
import { RedisClient } from '@/service/redis-client'
import { ITimeTotals } from '@/model/time'
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
        const project = await this.projectRepository.findProjectForTimeTracking(
          item.projectId,
          user,
        )

        let time = await this.timeRepository.findTimeSingleForProject(
          project,
          fromAt,
          toAt,
        )

        if (!time) {
          time = new Time()
          time.user = user
        } else if (time.user?.id !== user.id) {
          throw new AccessException(
            `Wrong user: the given time belongs to someone else`,
          )
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
      } catch (error: unknown) {
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

  public async setIsPaidMany(
    ids: string[],
    isPaid: boolean,
    user: User,
  ): Promise<void> {
    const times = await this.timeRepository.findByIdsAsAuthor(ids, user)

    for (const time of times) {
      time.isPaid = isPaid
    }

    await this.timeRepository.saveMany(times)
  }

  public async editAndSave(time: Time, data: Time): Promise<void> {
    time.note = data.note

    if (data.isPaid !== undefined) {
      time.isPaid = data.isPaid
    }

    await this.timeRepository.validateAndSave(time)
  }

  public async removeScreenshots(ids: string[], user: User): Promise<void> {
    const times = await this.timeRepository.findByIdsAsAuthor(ids, user)

    for (const time of times) {
      time.screenshot = null
    }

    await this.timeRepository.saveMany(times)
  }

  public async removeProcesses(ids: string[], user: User): Promise<void> {
    const times = await this.timeRepository.findByIdsAsAuthor(ids, user)

    for (const time of times) {
      time.processes = null
    }

    await this.timeRepository.saveMany(times)
  }

  public async removeMany(ids: string[], user: User): Promise<void> {
    const times = await this.timeRepository.findByIdsAsAuthor(ids, user)

    await this.timeRepository.removeMany(times)
  }

  public async buildAndCacheReport(
    project: Project,
    user: User,
  ): Promise<{
    totals: ITimeTotals[]
    time: Time[]
  }> {
    const cache = await this.redisClient.get(project.id)

    if (
      cache &&
      typeof cache === 'object' &&
      'totals' in cache &&
      'time' in cache
    ) {
      return cache as {
        totals: ITimeTotals[]
        time: Time[]
      }
    }

    const data = {
      totals: await this.timeRepository.getTotals(user, project.id),
      time: await this.timeRepository.findAllTimeForProject(project, user),
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
