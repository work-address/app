import {expect} from 'chai';
import {suite, test} from '@testdeck/mocha';

import {UserRepository} from '../../repository/UserRepository';
import {BaseControllerTest} from './BaseController.test';
import {RedisClient} from '../../service/RedisClient';
import {AuthenticatorTimeTracker} from '../../service/auth/AuthenticatorTimeTracker';
import {EAuthTimeTrackerState} from '../../interface/EAuthTimeTrackerState';

@suite()
export class AuthTimeTrackerControllerTest extends BaseControllerTest {
  protected userRepository: UserRepository;
  protected redisClient: RedisClient;
  protected authenticatorTimeTracker: AuthenticatorTimeTracker;

  constructor() {
    super();

    this.redisClient = this.container.get('RedisClient');
    this.authenticatorTimeTracker = this.container.get('AuthenticatorTimeTracker');
  }

  @test()
  async timeTrackerNonceGenerate() {
    const ip = '127.0.0.1';
    const res = await this.http.request({
      url: `${this.url}/api/auth/timeTracker/nonce`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const nonce = res.data.nonce as string;
    const key = `timetracker:nonce:${nonce}`;
    const data = await this.redisClient.get(key);

    expect(res.status).to.be.equal(200);
    expect(nonce.length).to.be.eq(32);
    expect(data).to.be.deep.eq({
      nonce,
      ip,
      startAt: data.startAt,
      state: EAuthTimeTrackerState.INIT,
    });
  }

  @test()
  async timeTrackerNonceGet() {
    const ip = '127.0.0.1';
    const nonce = await this.authenticatorTimeTracker.timeTrackerNonceGenerate(ip);
    const user = await this.userFixture.createUser();
    const token = this.authenticator.generateJwtToken(user);

    const res = await this.http.request({
      url: `${this.url}/api/auth/timeTracker/${nonce.nonce}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
    });

    const key = `timetracker:nonce:${nonce.nonce}`;
    const data = await this.redisClient.get(key);

    expect(res.status).to.be.equal(200);
    expect(res.data).to.be.deep.equal(data);
  }

  @test()
  async timeTrackerLogin() {
    const ip = '127.0.0.1';
    const nonce = await this.authenticatorTimeTracker.timeTrackerNonceGenerate(ip);

    const res = await this.http.request({
      url: `${this.url}/api/auth/timeTracker/${nonce.nonce}/login`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        nonce,
      },
    });

    expect(res.status).to.be.equal(200);
    expect(res.data).to.be.deep.eq({});
  }

  @test()
  async timeTrackerConnect() {
    const ip = '127.0.0.1';
    const user = await this.userFixture.createUser();
    const token = this.authenticator.generateJwtToken(user);

    const nonce = await this.authenticatorTimeTracker.timeTrackerNonceGenerate(ip);
    await this.authenticatorTimeTracker.timeTrackerLogin(nonce.nonce, ip);

    const res = await this.http.request({
      url: `${this.url}/api/auth/timeTracker/${nonce.nonce}/connect`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
    });

    expect(res.status).to.be.equal(200);
    expect(res.data).to.be.deep.eq({});
  }

  @test()
  async timeTrackerJwt() {
    const ip = '127.0.0.1';
    const user = await this.userFixture.createUser();
    const nonce = await this.authenticatorTimeTracker.timeTrackerNonceGenerate(ip);

    await this.authenticatorTimeTracker.timeTrackerLogin(nonce.nonce, ip);
    await this.authenticatorTimeTracker.timeTrackerConnect(nonce.nonce, user, ip);

    const res = await this.http.request({
      url: `${this.url}/api/auth/timeTracker/${nonce.nonce}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(res.status).to.be.equal(200);
    expect(res.data.nonce).to.be.eq(nonce.nonce);
    expect(res.data.state).to.be.eq(EAuthTimeTrackerState.CONNECTED);
    expect(res.data.ip).to.be.eq(ip);
    expect(res.data).to.have.property('jwt');
  }
}
