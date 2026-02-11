import _ from 'lodash';
import {inject, injectable} from 'inversify';

import {Filter} from '../service/Filter';
import {AbstractRepositoryTemplate} from './AbstractRepositoryTemplate';
import {Proposal} from '../entity/Proposal';
import {ActivityRepository} from './ActivityRepository';
import {ISearchProposal} from '../interface/search/ISearchProposal';
import {User} from '../entity/User';
import {SelectQueryBuilder} from 'typeorm';
import {EActivityState} from '../interface/EActivityState';
// import {EActivityState} from '../interface/EActivityState';

@injectable()
export class ProposalRepository extends AbstractRepositoryTemplate<Proposal> {
  @inject('Filter')
  protected filter: Filter;
  protected target = Proposal;
  @inject('ActivityRepository')
  protected activityRepository: ActivityRepository;

  public async findAndCountBusiness(
    search: ISearchProposal,
    user: User
  ): Promise<[Proposal[], number]> {
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
    const sort = this.filter.buildOrderByCondition('proposal', s);
    const limit = this.filter.buildLimit(search);

    return this.getRepo()
      .createQueryBuilder('proposal')
      .innerJoin('proposal.activity', 'activity')
      .innerJoin('activity.user', 'user')
      .where((qb: SelectQueryBuilder<Proposal>) => {
        qb.andWhere('user.id = :userId', {userId: user.id});
        this.buildSearchQueries(qb, search);
      })
      .select()
      .orderBy(sort)
      .skip(limit * s.page)
      .take(limit)
      .getManyAndCount();
  }

  public async findAndCountFreelancer(
    search: ISearchProposal,
    user: User
  ): Promise<[Proposal[], number]> {
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
    const sort = this.filter.buildOrderByCondition('proposal', s);
    const limit = this.filter.buildLimit(search);

    return this.getRepo()
      .createQueryBuilder('proposal')
      .innerJoin('proposal.user', 'user')
      .innerJoin('proposal.activity', 'activity')
      .where((qb: SelectQueryBuilder<Proposal>) => {
        qb.andWhere('user.id = :userId', {userId: user.id});
        qb.andWhere(`activity.state IN (:...state)`, {
          state: [
            EActivityState.PUBLISHED,
            EActivityState.ACTIVE,
            EActivityState.CLOSED,
            EActivityState.ARCHIVED,
          ],
        });

        this.buildSearchQueries(qb, search);
      })
      .select()
      .orderBy(sort)
      .skip(limit * s.page)
      .take(limit)
      .getManyAndCount();
  }

  private buildSearchQueries(
    qb: SelectQueryBuilder<Proposal>,
    search: ISearchProposal
  ): SelectQueryBuilder<Proposal> {
    if ('activityId' in search.filter) {
      qb.andWhere('activity.id = :activityId', {activityId: search.filter.activityId});
    }

    return qb;
  }
}
