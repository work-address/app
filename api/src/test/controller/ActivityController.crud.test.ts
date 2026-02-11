import faker from 'faker';
import {expect} from 'chai';
import {suite, test} from '@testdeck/mocha';

import {BaseControllerTest} from './BaseController.test';
import {ActivityManager} from '../../service/ActivityManager';
import {ActivityRepository} from '../../repository/ActivityRepository';
import {EActivityState} from '../../interface/EActivityState';
import {EActivityType} from '../../interface/EActivityType';

@suite
export class ActivityControllerCrudTest extends BaseControllerTest {
  protected activityManager: ActivityManager;
  protected activityRepository: ActivityRepository;

  constructor() {
    super();

    this.activityRepository = this.container.get('ActivityRepository');
    this.activityManager = this.container.get('ActivityManager');
  }

  @test
  async create() {
    const business = await this.userFixture.createUser();
    const data = {
      trackScreenshots: false,
      trackProcesses: true,
      title: faker.datatype.uuid(),
      text: faker.datatype.uuid(),
      state: EActivityState.DRAFT,
      type: EActivityType.HOURLY,
    };

    const res = await this.http.request({
      url: `${this.url}/api/activity`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(business).accessToken,
      },
      data,
    });

    const id = res.headers.location.split('/')[3];
    const activity = await this.activityRepository.findOneByIdOrFail(id);

    expect(res.status).to.be.equal(201);

    expect(activity.title).to.be.eq(data.title);
    expect(activity.text).to.be.eq(data.text);
    expect(activity.trackScreenshots).to.be.eq(data.trackScreenshots);
    expect(activity.trackProcesses).to.be.eq(data.trackProcesses);
  }

  @test
  async readAsGuest() {
    const business = await this.userFixture.createUser();
    const freelancer = await this.userFixture.createUser();
    const activity = await this.activityFixture.create(business, EActivityState.PUBLISHED);
    await this.proposalFixture.create(activity, freelancer);

    const proposal = await this.proposalFixture.create(activity, freelancer);

    await this.activityManager.acceptProposal(activity, proposal);

    const res = await this.http.request({
      url: `${this.url}/api/activity/${activity.id}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(res.status).to.be.equal(200);
    expect(res.data.id).to.be.equal(activity.id);
    expect(res.data.state).to.be.equal(EActivityState.ACTIVE);
    expect(res.data.user.id).to.be.equal(business.id);
    expect(res.data).not.haveOwnProperty('proposalAccepted');
    expect(res.data).not.haveOwnProperty('proposals');
  }

  @test
  async readAsFreelancer() {
    const business = await this.userFixture.createUser();
    const freelancer = await this.userFixture.createUser();
    const activity = await this.activityFixture.create(business, EActivityState.PUBLISHED);

    await this.proposalFixture.create(activity, freelancer);

    const res = await this.http.request({
      url: `${this.url}/api/activity/${activity.id}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(freelancer).accessToken,
      },
    });

    expect(res.status).to.be.equal(200);
    expect(res.data.id).to.be.equal(activity.id);
    expect(res.data.user.id).to.be.equal(business.id);
    expect(res.data.state).to.be.equal(EActivityState.PUBLISHED);
    expect(res.data.proposalAccepted).to.be.null;
  }

  @test
  async readAsFreelancerWithProposalAccepted() {
    const business = await this.userFixture.createUser();
    const freelancer = await this.userFixture.createUser();
    const activity = await this.activityFixture.create(business, EActivityState.PUBLISHED);
    const proposal = await this.proposalFixture.create(activity, freelancer);

    await this.activityManager.acceptProposal(activity, proposal);

    const res = await this.http.request({
      url: `${this.url}/api/activity/${activity.id}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(freelancer).accessToken,
      },
    });

    expect(res.status).to.be.equal(200);
    expect(res.data.id).to.be.equal(activity.id);
    expect(res.data.user.id).to.be.equal(business.id);
    expect(res.data.proposalAccepted.user.id).to.be.equal(freelancer.id);
    expect(res.data.state).to.be.equal(EActivityState.ACTIVE);
  }

  @test
  async readAsBusinessWithProposals() {
    const business = await this.userFixture.createUser();
    const freelancer = await this.userFixture.createUser();
    const activity = await this.activityFixture.create(business, EActivityState.PUBLISHED);
    const proposal = await this.proposalFixture.create(activity, freelancer);

    const res = await this.http.request({
      url: `${this.url}/api/activity/${activity.id}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(business).accessToken,
      },
    });

    expect(res.status).to.be.equal(200);
    expect(res.data.id).to.be.equal(activity.id);
    expect(res.data.proposals.length).to.be.equal(1);
    expect(res.data.proposals[0].id).to.be.equal(proposal.id);
    expect(res.data.state).to.be.equal(EActivityState.PUBLISHED);
    expect(res.data.proposalAccepted).to.be.null;
  }

  @test
  async readAsBusinessWithProposalAccepted() {
    const business = await this.userFixture.createUser();
    const freelancer = await this.userFixture.createUser();
    const activity = await this.activityFixture.create(business, EActivityState.PUBLISHED);
    await this.proposalFixture.create(activity, freelancer);

    const proposal = await this.proposalFixture.create(activity, freelancer);

    await this.activityManager.acceptProposal(activity, proposal);

    const res = await this.http.request({
      url: `${this.url}/api/activity/${activity.id}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(business).accessToken,
      },
    });

    expect(res.status).to.be.equal(200);
    expect(res.data.id).to.be.equal(activity.id);
    expect(res.data.proposals.length).to.be.equal(2);
    expect(res.data.proposalAccepted.id).to.be.equal(proposal.id);
  }

  @test
  async edit() {
    const business = await this.userFixture.createUser();
    const activity = await this.activityFixture.create(business, EActivityState.DRAFT);

    const data = {
      title: faker.datatype.uuid(),
      text: faker.datatype.uuid(),
      state: EActivityState.PUBLISHED,
      trackScreenshots: true,
      trackProcesses: true,
    };

    const res = await this.http.request({
      url: `${this.url}/api/activity/${activity.id}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(business).accessToken,
      },
      data,
    });

    const activityUpdated = await this.activityRepository.findOneByIdOrFail(activity.id);

    expect(res.status).to.be.equal(200);
    expect(res.data).to.be.deep.equal({});

    expect(activityUpdated.title).to.be.eq(data.title);
    expect(activityUpdated.state).to.be.eq(data.state);
    expect(activityUpdated.text).to.be.eq(data.text);
    expect(activityUpdated.trackScreenshots).to.be.eq(data.trackScreenshots);
    expect(activityUpdated.trackProcesses).to.be.eq(data.trackProcesses);
  }

  @test
  async delete() {
    const business = await this.userFixture.createUser();
    const activity = await this.activityFixture.create(business, EActivityState.PUBLISHED);

    const res = await this.http.request({
      url: `${this.url}/api/activity/${activity.id}`,
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(business).accessToken,
      },
    });

    const updated = await this.activityRepository.findOneBy({
      where: {
        id: activity.id,
      },
    });

    expect(res.status).to.be.equal(200);
    expect(res.data).to.be.deep.equal({});
    expect(updated).to.be.undefined;
  }
}
