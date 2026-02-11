import {expect} from 'chai';
import {suite, test} from '@testdeck/mocha';

import {BaseControllerTest} from './BaseController.test';
import {ActivityManager} from '../../service/ActivityManager';
import {ProposalRepository} from '../../repository/ProposalRepository';
import {EActivityState} from '../../interface/EActivityState';

@suite
export class ProposalControllerTest extends BaseControllerTest {
  protected activityManager: ActivityManager;
  protected proposalRepository: ProposalRepository;

  constructor() {
    super();

    this.proposalRepository = this.container.get('ProposalRepository');
    this.activityManager = this.container.get('ActivityManager');
  }

  @test()
  async searchAsBusiness() {
    const business = await this.userFixture.createUser();
    const freelancer = await this.userFixture.createUser();
    const activity = await this.activityFixture.create(business, EActivityState.PUBLISHED);
    const proposal = await this.proposalFixture.create(activity, freelancer);

    const config = {
      url: `${this.url}/api/proposal/search/business`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(business).accessToken,
      },
      data: {
        filter: {
          activityId: activity.id,
        },
        sort: {createdAt: 'ASC'},
        page: 0,
      },
    };

    const res = await this.http.request(config);

    expect(res.data[0].length).to.be.eq(1);
    expect(res.data[0][0].id).to.be.eq(proposal.id);
  }

  @test()
  async searchAsFreelancer() {
    const business = await this.userFixture.createUser();
    const freelancerA = await this.userFixture.createUser();
    const freelancerB = await this.userFixture.createUser();
    const activity = await this.activityFixture.create(business, EActivityState.PUBLISHED);

    const proposal = await this.proposalFixture.create(activity, freelancerA);
    await this.proposalFixture.create(activity, freelancerB);

    const config = {
      url: `${this.url}/api/proposal/search/freelancer`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(freelancerA).accessToken,
      },
      data: {
        filter: {
          activityId: activity.id,
        },
        sort: {createdAt: 'ASC'},
        page: 0,
      },
    };

    const res = await this.http.request(config);

    expect(res.data[0].length).to.be.eq(1);
    expect(res.data[0][0].id).to.be.eq(proposal.id);
  }
}
