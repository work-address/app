import faker from 'faker';
import {expect} from 'chai';
import * as web3 from 'web3';
import {suite, test} from '@testdeck/mocha';

import {UserRepository} from '../../repository/UserRepository';
import {BaseControllerTest} from './BaseController.test';
import {RedisClient} from '../../service/RedisClient';
import {AuthenticatorTimeTracker} from '../../service/auth/AuthenticatorTimeTracker';
import {ActivityRepository} from '../../repository/ActivityRepository';
import {TimeRepository} from '../../repository/TimeRepository';
import moment from 'moment';

@suite()
export class AuthControllerTest extends BaseControllerTest {
  protected userRepository: UserRepository;
  protected redisClient: RedisClient;
  protected authenticatorTimeTracker: AuthenticatorTimeTracker;
  protected activityRepository: ActivityRepository;
  protected timeRepository: TimeRepository;

  constructor() {
    super();

    this.redisClient = this.container.get('RedisClient');
    this.userRepository = this.container.get('UserRepository');
    this.activityRepository = this.container.get('ActivityRepository');
    this.timeRepository = this.container.get('TimeRepository');
  }

  @test()
  async loginEth() {
    const account = web3.eth.accounts.create();
    const nonce = await this.authenticator.getNonce(account.address);
    const signature = web3.eth.accounts.sign(nonce, account.privateKey);

    const res = await this.http.request({
      url: `${this.url}/api/auth/eth`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        signature: signature.signature,
        address: account.address,
      },
    });

    const user = await this.userRepository.findByAddressPublicOrFail(account.address);
    const activity = await this.activityRepository.findOneByOrFail({
      where: {
        user,
      },
    });
    const times = await this.timeRepository.findAllTimeForActivity(activity, user);

    const fromAt = moment().startOf('day').add(50, 'minutes');

    expect(res.status).to.be.equal(200);
    expect(res.data).to.be.deep.equal({});
    expect(activity.title).to.be.equal('Your first project');
    expect(times.length).to.be.equal(6);
    expect(times[0].fromAt.toISOString()).to.be.equal(fromAt.toISOString());
  }

  @test()
  async nonce() {
    const account = web3.eth.accounts.create();

    const res = await this.http.request({
      url: `${this.url}/api/auth/nonce`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        address: account.address,
      },
    });

    expect(res.status).to.be.equal(200);
    expect(res.data.length).to.be.eq(32);
  }

  @test()
  async refresh() {
    const user = await this.userFixture.createUser();

    const config = {
      url: `${this.url}/api/auth/refresh`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        refreshToken: this.authenticator.generateRefreshToken(user),
      },
    };

    const res = await this.http.request(config);

    expect(res.status).to.be.equal(200);
    expect(res.headers).to.contain.keys(['authorization', 'refresh-token']);
  }

  @test()
  async status_user() {
    const user = await this.userFixture.createUser();
    const token = this.authenticator.generateJwtToken(user);

    const config = {
      url: `${this.url}/api/auth/status`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
    };

    const res = await this.http.request(config);

    expect(res.data).to.have.property('id');
    expect(res.data).not.to.have.property('password');
    expect(res.data).not.to.have.property('resetPasswordJwtIat');

    expect(res.data.email).to.be.equal(user.email);
    expect(res.data.id).to.be.equal(user.id);
  }

  @test()
  async status_invalidDoNotThrowException() {
    const token = faker.datatype.uuid();

    const config = {
      url: `${this.url}/api/auth/status`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
    };

    const res = await this.http.request(config);

    expect(res.data).to.be.equal('');
  }
}
