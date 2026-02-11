import {suite, test} from '@testdeck/mocha';
import faker from 'faker';
import {expect} from 'chai';
import * as jwt from 'jsonwebtoken';
import * as web3 from 'web3';

import {Authenticator} from '../../service/auth/Authenticator';
import {User} from '../../entity/User';
import {UserFixture} from '../fixture/UserFixture';
import {AbstractDatabaseIntegration} from '../AbstractDatabase.integration';
import {UserRepository} from '../../repository/UserRepository';

@suite()
export class AuthenticatorTest extends AbstractDatabaseIntegration {
  protected authenticator: Authenticator;
  protected userFixture: UserFixture;
  protected userRepository: UserRepository;

  constructor() {
    super();

    this.authenticator = this.container.get('Authenticator');
    this.userRepository = this.container.get('UserRepository');
    this.userFixture = this.container.get('UserFixture');
  }

  @test()
  async getUserFromJwtToken() {
    const email = faker.internet.email();
    const user = await this.userFixture.createWithEmailAndPassword(email);

    const token = this.authenticator.generateJwtToken(user);
    const userFromToken = await this.authenticator.getUserFromJwtToken(token);

    expect(userFromToken.id).to.be.equal(user.id);
  }

  @test()
  async getUserFromJwtToken_afterEmailChange() {
    const email = faker.internet.email();
    const user = await this.userFixture.createWithEmailAndPassword(email);
    const token = this.authenticator.generateJwtToken(user);

    // email change
    const userUpdate = await this.userRepository.findByEmailPhoneOrFail(user.email);
    userUpdate.email = faker.internet.email();
    await this.userRepository.saveSingle(userUpdate);

    const userFromToken = await this.authenticator.getUserFromJwtToken(token);

    expect(userFromToken.id).to.be.equal(user.id);
  }

  @test()
  generateJwtToken() {
    const user = new User();
    user.email = faker.internet.email();

    const token = this.authenticator.generateJwtToken(user);

    expect(token.split('.').length).to.be.equal(3);
  }

  @test()
  generateRefreshJwtToken() {
    const user = new User();
    user.id = faker.datatype.uuid();
    user.email = faker.internet.email();

    const refreshToken = this.authenticator.generateRefreshToken(user);

    const payload = jwt.verify(refreshToken, this.parameters.jwtSecret);

    expect(payload).to.include({id: user.id});
    expect(payload).to.include.all.keys('exp', 'iat');
  }

  @test()
  async getUserFromRefreshToken_success() {
    const email = faker.internet.email();
    const user = await this.userFixture.createWithEmailAndPassword(email);

    const tokens = this.authenticator.getTokens(user);

    const userFromToken = await this.authenticator.getUserFromRefreshToken(tokens.refreshToken);

    expect(userFromToken.id).to.be.eq(user.id);
  }

  @test()
  async getUserFromRefreshToken_failNotValid() {
    const refreshToken = jwt.sign({id: ''}, this.parameters.jwtSecret, {
      expiresIn: 60 * 60 * 24,
    });

    try {
      await this.authenticator.getUserFromRefreshToken(refreshToken);
    } catch (err: any) {
      expect(err.name).to.be.eq('AuthenticationException');
      expect(err.message).to.be.eq('Authentication error: Refresh token is not valid');
    }
  }

  @test()
  async getUserFromRefreshToken_failExpired() {
    const date = new Date();
    const iat = Math.floor(
      new Date(date.setDate(date.getDate() - 1)).setHours(date.getHours() - 1).valueOf() / 1000
    );
    const refreshToken = jwt.sign({id: faker.random.word(), iat}, this.parameters.jwtSecret, {
      expiresIn: 60 * 60 * 24,
    });

    try {
      await this.authenticator.getUserFromRefreshToken(refreshToken);
    } catch (err: any) {
      expect(err.name).to.be.eq('TokenExpiredError');
    }
  }

  @test()
  async getUserFromRefreshToken_failUserDoesNotExist() {
    const refreshToken = jwt.sign({id: faker.datatype.number()}, this.parameters.jwtSecret, {
      expiresIn: 60 * 60 * 24,
    });

    try {
      await this.authenticator.getUserFromRefreshToken(refreshToken);
    } catch (err: any) {
      expect(err.name).to.be.eq('AuthenticationException');
      expect(err.message).to.be.eq('Authentication error: User does not exist');
    }
  }

  @test()
  getEmailFromJwtOrThrowError_success() {
    const user = new User();
    user.email = faker.internet.email();

    const token = this.authenticator.generateJwtToken(user);
    const email = this.authenticator.getEmailOrPhoneOrThrowError(token);

    expect(user.email).to.be.equal(email);
  }

  @test()
  getEmailFromJwtOrThrowError_errorMalformed() {
    let error;
    const token = faker.datatype.uuid();

    try {
      this.authenticator.getEmailOrPhoneOrThrowError(token);
    } catch (e: any) {
      error = e;
    }

    expect(error.name).to.be.eq('JsonWebTokenError');
    expect(error.message).to.be.eq('jwt malformed');
  }

  @test()
  getEmailFromJwtOrThrowError_errorExpired() {
    let error;
    const oldToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbE9yUGhvbmUiOiJPbGdhNTBAeWFob28uY29tIiwiaWF0IjoxNzAzNTg5NzE4LCJleHAiOjE3MDM2MDA1MTh9.Y2De_m7g_ZLmugywlDseKLmPPnJqek_CJl1VIfJe-2o';

    try {
      this.authenticator.getEmailOrPhoneOrThrowError(oldToken);
    } catch (e: any) {
      error = e;
    }

    expect(error.name).to.be.eq('TokenExpiredError');
    expect(error.message).to.be.eq('jwt expired');
  }

  @test()
  async loginWeb3_register() {
    const account = web3.eth.accounts.create();

    const nonce = await this.authenticator.getNonce(account.address);
    const signature = web3.eth.accounts.sign(nonce, account.privateKey);
    const tokens = await this.authenticator.loginEth(signature.signature, account.address);

    const userDB = await this.userRepository.findByAddressPublicOrFail(account.address);

    expect(tokens).to.contain.keys(['accessToken', 'refreshToken']);
    expect(userDB.address).to.be.eq(account.address);
  }

  @test()
  async loginWeb3_login() {
    const account = web3.eth.accounts.create();
    const user = await this.userFixture.createUserFromKeypair(account);

    const nonce = await this.authenticator.getNonce(user.address);
    const signature = web3.eth.accounts.sign(nonce, account.privateKey);
    const tokens = await this.authenticator.loginEth(signature.signature, account.address);

    const userDB = await this.userRepository.findByAddressPublicOrFail(account.address);

    expect(tokens).to.contain.keys(['accessToken', 'refreshToken']);
    expect(userDB.id).to.be.eq(user.id);
  }

  @test()
  async loginWeb3_failsWrongNonce() {
    const accountA = web3.eth.accounts.create();
    const accountB = web3.eth.accounts.create();

    const nonce = await this.authenticator.getNonce(accountA.address);
    const signature = web3.eth.accounts.sign(nonce, accountB.privateKey);

    let err = null;

    try {
      await this.authenticator.loginEth(signature.signature, accountB.address);
    } catch (e: any) {
      err = e;
    }

    expect(err.name).to.be.equal('AuthenticationException');
    expect(err.message).to.be.equal('Authentication error: Nonce is not available or expired');
  }
}
