import {inject, injectable} from 'inversify';

import {Activity} from '../entity/Activity';
import {ActivityRepository} from '../repository/ActivityRepository';
import {Proposal} from '../entity/Proposal';
import RejectedExecutionException from '../exception/RejectedExecutionException';
import {EActivityState} from '../interface/EActivityState';
import {User} from '../entity/User';
import {EActivityType} from '../interface/EActivityType';
import moment from 'moment';
import {Time} from '../entity/Time';
import {TimeRepository} from '../repository/TimeRepository';

@injectable()
export class ActivityManager {
  @inject('ActivityRepository')
  protected activityRepository: ActivityRepository;
  @inject('TimeRepository')
  protected timeRepository: TimeRepository;

  public async findActivityCheckAccess(
    activity: Activity,
    user?: User
  ): Promise<Activity | undefined> {
    if (!user) {
      return this.activityRepository.findActivityAsGuest(activity);
    } else if (user.id === activity.user.id) {
      return this.activityRepository.findActivityAsBusiness(activity);
    }

    const findActivityAsFreelancer = await this.activityRepository.findActivityAsFreelancerOrFail(
      activity.id
    );

    const isProposee = findActivityAsFreelancer.proposalAccepted?.user.id === user.id;

    if (!isProposee) {
      findActivityAsFreelancer.proposalAccepted = null;
    }

    return findActivityAsFreelancer;
  }

  public async close(activity: Activity): Promise<void> {
    activity.closedAt = new Date();
    activity.state = EActivityState.CLOSED;

    await this.save(activity);
  }

  public async acceptProposal(activity: Activity, proposal: Proposal): Promise<void> {
    const isPrivateOrImport = [EActivityType.PERSONAL, EActivityType.IMPORT].includes(
      activity.type
    );
    const isPublished = [EActivityState.PUBLISHED].includes(activity.state);

    if (activity.proposalAccepted) {
      throw new RejectedExecutionException('Proposal was already assigned');
    }
    if (isPrivateOrImport || !isPublished) {
      throw new RejectedExecutionException('Activity is not available for proposals');
    }

    activity.proposalAccepted = proposal;
    activity.startedAt = new Date();
    activity.state = EActivityState.ACTIVE;

    await this.save(activity);
  }

  public async editAndSave(activity: Activity, data: Activity): Promise<void> {
    const isContract = [EActivityType.HOURLY, EActivityType.FIXED].includes(activity.type);
    const isActiveOrClosed = [EActivityState.ACTIVE, EActivityState.CLOSED].includes(
      activity.state
    );

    if (isContract && isActiveOrClosed) {
      throw new RejectedExecutionException(
        'Active or closed contracts are not available for editing'
      );
    }

    activity = Object.assign(activity, data);

    await this.save(activity);
  }

  public save(activity: Activity) {
    return this.activityRepository.saveSingle(activity);
  }

  public async createDemoData(user: User): Promise<void> {
    const activity = new Activity();
    activity.title = 'Your first project';
    activity.rateHour = 0;
    activity.user = user;
    activity.type = EActivityType.PERSONAL;
    activity.state = EActivityState.PUBLISHED;

    await this.save(activity);

    const times = [];
    const fromAt = moment().startOf('day');
    const toAt = moment().startOf('day').add(10, 'minutes');

    for (let i = 1; i <= 6; i++) {
      const time = new Time();
      time.activity = activity;
      time.note = `Timesheet demo ${i}`;
      time.mouseKeys = 0;
      time.mouseDistance = 0;
      time.keyboardKeys = 0;
      time.minutesActive = i;
      time.fromAt = fromAt.toDate();
      time.toAt = toAt.toDate();

      times.push(time);

      fromAt.add(1 * 10, 'minutes');
      toAt.add(1 * 10, 'minutes');
    }

    await this.timeRepository.saveMany(times);
  }
}
