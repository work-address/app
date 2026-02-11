import * as _ from 'lodash';
import {inject, injectable} from 'inversify';
import {SelectQueryBuilder} from 'typeorm';

import {Filter} from '../service/Filter';
import {AbstractRepositoryTemplate} from './AbstractRepositoryTemplate';
import {Activity} from '../entity/Activity';
import {ISearchActivity} from '../interface/search/ISearchActivity';
import {User} from '../entity/User';
import {EActivityState} from '../interface/EActivityState';
import {EActivityType} from '../interface/EActivityType';
import {Proposal} from '../entity/Proposal';

@injectable()
export class ActivityRepository extends AbstractRepositoryTemplate<Activity> {
  @inject('Filter')
  protected filter: Filter;
  protected target = Activity;

  public findOneByUrl(url: string): Promise<Activity | undefined> {
    return this.getRepo().findOne({
      where: {
        sourceUrl: url,
      },
    });
  }

  public findActivityAsGuest(activity: Activity): Promise<Activity | undefined> {
    return this.getRepo()
      .createQueryBuilder('activity')
      .leftJoinAndSelect('activity.user', 'user')
      .andWhere('activity.id = :id', {id: activity.id})
      .andWhere(`activity.state IN (:...state)`, {
        state: [
          EActivityState.PUBLISHED,
          EActivityState.ACTIVE,
          EActivityState.CLOSED,
          EActivityState.ARCHIVED,
        ],
      })
      .select()
      .getOne();
  }

  public findActivityAsBusiness(activity: Activity): Promise<Activity | undefined> {
    return this.getRepo()
      .createQueryBuilder('activity')
      .innerJoinAndSelect('activity.user', 'user')
      .leftJoinAndSelect('activity.proposals', 'proposals')
      .leftJoinAndSelect('activity.proposalAccepted', 'proposalAccepted')
      .leftJoinAndSelect('proposalAccepted.user', 'freelancer')
      .andWhere('activity.id = :activityId', {activityId: activity.id})
      .select()
      .getOne();
  }

  public findActivityAsFreelancerOrFail(id: string): Promise<Activity> {
    return this.getRepo()
      .createQueryBuilder('activity')
      .innerJoinAndSelect('activity.user', 'user')
      .leftJoinAndSelect('activity.proposalAccepted', 'proposalAccepted')
      .leftJoinAndSelect('proposalAccepted.user', 'freelancer')
      .andWhere('activity.id = :id', {id})
      .andWhere(`activity.state IN (:...state)`, {
        state: [
          EActivityState.PUBLISHED,
          EActivityState.ACTIVE,
          EActivityState.CLOSED,
          EActivityState.ARCHIVED,
        ],
      })
      .select()
      .getOneOrFail();
  }

  public findActivityByFreelancer(activity: Activity, user: User): Promise<Activity | undefined> {
    return this.getRepo()
      .createQueryBuilder('activity')
      .innerJoinAndSelect('activity.proposalAccepted', 'proposalAccepted')
      .innerJoinAndSelect('proposalAccepted.user', 'user')
      .andWhere('user.id = :userId', {id: user.id})
      .andWhere('activity.id = :id', {id: activity.id})
      .select()
      .getOne();
  }

  public findActivityPersonal(activity: Activity, user: User): Promise<Activity | undefined> {
    return this.getRepo()
      .createQueryBuilder('activity')
      .innerJoinAndSelect('activity.user', 'user')
      .andWhere('activity.id = :id', {id: activity.id})
      .andWhere('user.id = :userId', {userId: user.id})
      .andWhere(`activity.type = :type`, {type: EActivityType.PERSONAL})
      .andWhere(`activity.state = :state`, {state: EActivityState.PUBLISHED})
      .select()
      .getOne();
  }

  public findActivityByProposalAccepted(proposal: Proposal): Promise<Activity | undefined> {
    return this.getRepo()
      .createQueryBuilder('activity')
      .innerJoinAndSelect('activity.proposalAccepted', 'proposalAccepted')
      .andWhere(`proposalAccepted.id = :type`, {id: proposal.id})
      .select()
      .getOne();
  }

  public async findAndCountFreelancer(
    search: ISearchActivity,
    user: User
  ): Promise<[Activity[], number]> {
    const s = _.assign(
      {
        filter: {},
        sort: {
          createdAt: 'ASC',
        },
        page: 0,
      },
      search
    );
    const sort = this.filter.buildOrderByCondition('activity', s);
    const limit = this.filter.buildLimit(search);
    const query = this.getRepo()
      .createQueryBuilder('activity')
      .select()
      .where((qb: SelectQueryBuilder<Activity>) => {
        qb.andWhere('activity.user.id = :userId', {userId: user.id});
      })
      .andWhere(`activity.type IN (:...types)`, {
        types: [EActivityType.HOURLY, EActivityType.PERSONAL, EActivityType.FIXED],
      })
      .andWhere(`activity.state = :state`, {state: EActivityState.PUBLISHED})
      .orderBy(sort)
      .skip(limit * s.page)
      .take(limit);

    return query.getManyAndCount();
  }

  public async findAndCount(search: ISearchActivity): Promise<[Activity[], number]> {
    const s = _.assign(
      {
        filter: {},
        sort: {
          createdAt: 'ASC',
        },
        page: 0,
      },
      search
    );
    const sort = this.filter.buildOrderByCondition('activity', s);
    const limit = this.filter.buildLimit(search);
    const query = this.getRepo()
      .createQueryBuilder('activity')
      .select()
      .where((qb: SelectQueryBuilder<Activity>) => {
        this.buildSearchQueries(qb, search);
      })
      .andWhere(`activity.type IN (:...types)`, {
        types: [EActivityType.IMPORT, EActivityType.HOURLY, EActivityType.FIXED],
      })
      .andWhere(`activity.state = :state`, {state: EActivityState.PUBLISHED})
      .andWhere('activity.cancelledAt IS NULL')
      .andWhere('activity.deletedAt IS NULL')
      .orderBy(sort)
      .skip(limit * s.page)
      .take(limit);

    return query.getManyAndCount();
  }

  public async findAndCountBusiness(
    search: ISearchActivity,
    user: User
  ): Promise<[Activity[], number]> {
    const s = _.assign(
      {
        filter: {},
        sort: {
          createdAt: 'ASC',
        },
        page: 0,
      },
      search
    );
    const sort = this.filter.buildOrderByCondition('activity', s);
    const limit = this.filter.buildLimit(search);

    return this.getRepo()
      .createQueryBuilder('activity')
      .select()
      .where((qb: SelectQueryBuilder<Activity>) => {
        qb.andWhere('activity.user.id = :userId', {userId: user.id});

        if ('state' in s.filter) {
          qb.andWhere('activity.state = :state', {state: s.filter.state});
        }
        if ('activityId' in s.filter) {
          qb.andWhere('activity.id = :activityId', {state: s.filter.activityId});
        }
        if ('type' in s.filter) {
          qb.andWhere('activity.type = :type', {type: s.filter.type});
        }
      })
      .orderBy(sort)
      .skip(limit * s.page)
      .take(limit)
      .getManyAndCount();
  }

  private buildSearchQueries(
    qb: SelectQueryBuilder<Activity>,
    search: ISearchActivity
  ): SelectQueryBuilder<Activity> {
    if ('userId' in search.filter) {
      qb.andWhere('activity.user.id = :userId', {userId: search.filter.userId});
    }
    if ('keywords' in search.filter) {
      // qb.andWhere(`activity.keywords ::jsonb @> \'([:...keywords])\'`, { keywords: search.filter.keywords });
      qb.andWhere(`activity.keywords::jsonb ?| ARRAY[:...keywords]`, {
        keywords: search.filter.keywords,
      });
    }

    return qb;
  }
}
