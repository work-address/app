import {inject, injectable} from 'inversify';
import moment from 'moment';

import {Time} from '../entity/Time';
import {User} from '../entity/User';
import {TimeRepository} from '../repository/TimeRepository';
import {ActivityRepository} from '../repository/ActivityRepository';
import {ITimeInsertionResult} from '../interface/ITimeInsertionResult';
import {ErrorFormatter} from './ErrorFormatter';
import {TimeCreateDto} from '../validator/dto/TimeCreateDto';
import {Activity} from '../entity/Activity';
import {RedisClient} from './RedisClient';
import {ITimeTotals} from '../interface/ITimeTotals';
import {EActivityState} from '../interface/EActivityState';
import AccessException from '../exception/AccessException';
import {ImageResizer} from './ImageResizer';

@injectable()
export class TimeManager {
  @inject('TimeRepository')
  protected timeRepository: TimeRepository;
  @inject('ActivityRepository')
  protected activityRepository: ActivityRepository;
  @inject('RedisClient')
  protected redisClient: RedisClient;
  @inject('ImageResizer')
  protected imageResizer: ImageResizer;

  public static reportExpiresIn: number = 1000 * 60 * 10; // 10 minutes

  public async createOrUpdateMany(
    data: TimeCreateDto[],
    user: User
  ): Promise<ITimeInsertionResult[]> {
    const insertionResults: ITimeInsertionResult[] = [];

    for (let a = 0; a < data.length; a++) {
      const item = data[a];
      const fromAt = moment(item.fromAt).toDate();
      const toAt = moment(item.toAt).toDate();

      try {
        const activity = await this.activityRepository.findActivityAsFreelancerOrFail(
          item.activityId
        );

        const isProposeeAndActive =
          activity.proposalAccepted?.user.id === user.id &&
          activity.state === EActivityState.ACTIVE;
        const isPersonalPublished =
          activity.user.id === user.id && activity.state === EActivityState.PUBLISHED;

        if (!isPersonalPublished && !isProposeeAndActive) {
          throw new AccessException(`The given activity is unavailable for time tracking`);
        }

        let time = await this.timeRepository.findTimeSingleForActivity(activity, fromAt, toAt);

        if (!time) {
          time = new Time();
        }

        // const resizedScreenshot = await this.resize(item.screenshot);
        // console.log('>>>>', resizedScreenshot?.length);

        time.fromAt = fromAt;
        time.toAt = toAt;
        time.note = item.note;
        time.minutesActive = item.minutesActive;
        time.keyboardKeys = item.keyboardKeys;
        time.mouseKeys = item.mouseKeys;
        time.mouseDistance = item.mouseDistance;
        time.activity = activity;
        time.screenshot = await this.resize(item.screenshot);
        time.processes = item.processes;

        const savedTime = await this.timeRepository.validateAndSave(time);
        
        insertionResults.push({
          ...item,
          id: savedTime.id,
          // TODO: remove screenshot and processes from the response
          screenshot: undefined,
          processes: undefined,
        });
      } catch (error: any) {
        insertionResults.push({
          ...item,
          error: ErrorFormatter.format(error),
          // TODO: remove screenshot and processes from the response
          screenshot: undefined,
          processes: undefined,
        });
      }
    }

    // console.log('>>>>', insertionResults);
    
    return insertionResults;
  }

  public async save(time: Time): Promise<Time> {
    return this.timeRepository.validateAndSave(time);
  }

  public async editAndSave(time: Time, data: Time, freelancer: User) {
    const timeExisting = await this.timeRepository.findTimeByFreelancerOrFail(time, freelancer);

    if (!timeExisting) {
      throw new AccessException(`The given time belongs to someone else`);
    }

    time = Object.assign(time, data);

    await this.timeRepository.validateAndSave(time);
  }

  public async remove(time: Time, freelancer: User) {
    const timeExisting = await this.timeRepository.findTimeByFreelancerOrFail(time, freelancer);

    if (!timeExisting) {
      throw new AccessException(`Wrong user: the given time belongs to someone else`);
    }

    await this.timeRepository.remove(timeExisting);
  }

  public async buildAndCacheReport(
    activity: Activity,
    user: User
  ): Promise<{
    totals: ITimeTotals[];
    time: Time[];
  }> {
    const data = {
      totals: await this.timeRepository.getTotals(user, activity.id),
      time: await this.timeRepository.findAllTimeForActivity(activity, user),
    };

    const cache = await this.redisClient.get(activity.id);

    if (cache) {
      return cache;
    }

    await this.redisClient.setWithExpiry(activity.id, data, TimeManager.reportExpiresIn);

    return data;
  }

  public async resize(screenshot?: string): Promise<string | null> {
    if (!screenshot) {
      return null;
    }
    
    return this.imageResizer.resize(screenshot, 600);
  }
}
