import faker from 'faker';
import {expect} from 'chai';
import {suite, test} from '@testdeck/mocha';

import {BaseControllerTest} from './BaseController.test';
import {ActivityManager} from '../../service/ActivityManager';
import {ActivityRepository} from '../../repository/ActivityRepository';
import {EActivityState} from '../../interface/EActivityState';
import {Activity} from '../../entity/Activity';
import {EActivityType} from '../../interface/EActivityType';

@suite
export class ActivityControllerTest extends BaseControllerTest {
  protected activityManager: ActivityManager;
  protected activityRepository: ActivityRepository;

  constructor() {
    super();

    this.activityRepository = this.container.get('ActivityRepository');
    this.activityManager = this.container.get('ActivityManager');
  }

  @test
  async acceptProposal() {
    const business = await this.userFixture.createUser();
    const freelancer = await this.userFixture.createUser();
    const activity = await this.activityFixture.create(business, EActivityState.PUBLISHED);
    const proposal = await this.proposalFixture.create(activity, freelancer);

    const res = await this.http.request({
      url: `${this.url}/api/activity/${activity.id}/accept/${proposal.id}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(business).accessToken,
      },
    });

    const updated = (await this.activityRepository.findOneByQueryBuilder({id: activity.id}, null, {
      proposalAccepted: true,
    })) as Activity;

    expect(res.status).to.be.equal(200);
    expect(res.data).to.be.deep.equal({});
    expect(updated.state).to.be.eq(EActivityState.ACTIVE);
    expect(updated.proposalAccepted?.id).to.be.eq(proposal.id);
  }

  @test
  async close() {
    const business = await this.userFixture.createUser();
    const activity = await this.activityFixture.create(business, EActivityState.PUBLISHED);

    const res = await this.http.request({
      url: `${this.url}/api/activity/${activity.id}/close`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(business).accessToken,
      },
    });

    const updated = await this.activityRepository.findOneByIdOrFail(activity.id);

    expect(res.status).to.be.equal(200);
    expect(res.data).to.be.deep.equal({});
    expect(updated.state).to.be.eq(EActivityState.CLOSED);
    expect(updated.closedAt).to.be.not.null;
  }

  @test()
  async searchKeywordsPositiveA() {
    const keywords = [faker.datatype.uuid(), faker.datatype.uuid(), faker.datatype.uuid()];
    const user = await this.userFixture.createUser();
    const activity = await this.activityFixture.create(user, EActivityState.PUBLISHED, keywords);

    const config = {
      url: `${this.url}/api/activity/search`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      data: {
        filter: {
          userId: user.id,
          keywords: [keywords[0], keywords[1]],
        },
        sort: {createdAt: 'ASC'},
        page: 0,
      },
    };

    const res = await this.http.request(config);

    expect(res.data[0].length).to.be.eq(1);
    expect(res.data[0][0].id).to.be.eq(activity.id);
    expect(res.data[0][0].keywords).to.be.deep.eq(keywords);
  }

  @test()
  async searchKeywordsPositiveB() {
    const keywords = [faker.datatype.uuid(), faker.datatype.uuid(), faker.datatype.uuid()];
    const user = await this.userFixture.createUser();
    const activity = await this.activityFixture.create(user, EActivityState.PUBLISHED, keywords);

    const config = {
      url: `${this.url}/api/activity/search`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      data: {
        filter: {
          userId: user.id,
          keywords: [keywords[0], keywords[1], 'AAAA'],
        },
        sort: {createdAt: 'ASC'},
        page: 0,
      },
    };

    const res = await this.http.request(config);

    expect(res.data[0].length).to.be.eq(1);
    expect(res.data[0][0].id).to.be.eq(activity.id);
    expect(res.data[0][0].keywords).to.be.deep.eq(keywords);
  }

  @test()
  async searchKeywordsNegatve() {
    const keywords = [faker.datatype.uuid(), faker.datatype.uuid(), faker.datatype.uuid()];
    const user = await this.userFixture.createUser();

    await this.activityFixture.create(user, EActivityState.PUBLISHED, keywords);

    const config = {
      url: `${this.url}/api/activity/search`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      data: {
        filter: {
          userId: user.id,
          keywords: ['AAAA'],
        },
        sort: {createdAt: 'ASC'},
        page: 0,
      },
    };

    const res = await this.http.request(config);

    expect(res.data).to.be.deep.eq([[], 0]);
  }

  @test()
  async searchFreelancerPersonalSorted() {
    const freelancer = await this.userFixture.createUser();
    const activityA = await this.activityFixture.createPersonal(freelancer);
    const activityB = await this.activityFixture.createPersonal(freelancer);
    const activityC = await this.activityFixture.createPersonal(freelancer);

    activityA.title = 'AAA';
    activityB.title = 'BBB';
    activityC.title = 'CCC';

    await this.activityRepository.saveMany([activityA, activityB, activityC]);

    const config = {
      url: `${this.url}/api/activity/search/freelancer`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(freelancer).accessToken,
      },
      data: {
        filter: {},
        sort: {title: 'ASC'},
        page: 0,
      },
    };

    const res = await this.http.request(config);

    expect(res.data[0].length).to.be.eq(3);
    expect(res.data[0][0].title).to.be.eq(activityA.title);
    expect(res.data[0][1].title).to.be.eq(activityB.title);
    expect(res.data[0][2].title).to.be.eq(activityC.title);
    expect(res.data[0][0].state).to.be.eq(EActivityState.PUBLISHED);
    expect(res.data[0][0].type).to.be.eq(EActivityType.PERSONAL);
  }

  @test()
  async searchBusinessDraft() {
    const user = await this.userFixture.createUser();
    const activity = await this.activityFixture.create(user, EActivityState.DRAFT);

    const config = {
      url: `${this.url}/api/activity/search/business`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      data: {
        filter: {
          userId: user.id,
          state: EActivityState.DRAFT,
        },
        sort: {createdAt: 'ASC'},
        page: 0,
      },
    };

    const res = await this.http.request(config);

    expect(res.data[0].length).to.be.eq(1);
    expect(res.data[0][0].id).to.be.eq(activity.id);
    expect(res.data[0][0].state).to.be.eq(EActivityState.DRAFT);
  }

  @test()
  async searchBusinessArchived() {
    const user = await this.userFixture.createUser();
    const activity = await this.activityFixture.create(user, EActivityState.ARCHIVED);

    const config = {
      url: `${this.url}/api/activity/search/business`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      data: {
        filter: {
          userId: user.id,
          state: EActivityState.ARCHIVED,
        },
        sort: {createdAt: 'ASC'},
        page: 0,
      },
    };

    const res = await this.http.request(config);

    expect(res.data[0].length).to.be.eq(1);
    expect(res.data[0][0].id).to.be.eq(activity.id);
    expect(res.data[0][0].state).to.be.eq(EActivityState.ARCHIVED);
  }
}
