import {expect} from 'chai';
import faker from 'faker';
import {suite, test} from '@testdeck/mocha';

import {BaseControllerTest} from './BaseController.test';
import {UserRepository} from '../../repository/UserRepository';
import {EUserRole} from '../../interface/EUserRole';

@suite()
export class UserControllerEditTest extends BaseControllerTest {
  protected userRepository: UserRepository;

  constructor() {
    super();

    this.userRepository = this.container.get('UserRepository');
  }

  @test()
  async edit() {
    const user = await this.userFixture.createUser();

    const data = {
      bio: faker.datatype.number(),
      roles: [EUserRole.ROLE_USER, EUserRole.ROLE_BUSINESS],
      tz: 'America/Los_Angeles',
      phone: this.faker.phone(),
      skills: faker.datatype.uuid(),
      userName: faker.name.firstName(),
      price: faker.datatype.number(50),
    };

    const config = {
      url: `${this.url}/api/user`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      data,
    };
    const res = await this.http.request(config);
    const updated = await this.userRepository.findByEmailPhoneOrFail(data.phone);

    expect(res.status).to.be.equal(204);
    expect(res.data).to.be.empty;

    expect(updated.bio).to.be.equal(data.bio.toString());
    expect(updated.roles).to.be.deep.equal([EUserRole.ROLE_USER, EUserRole.ROLE_BUSINESS]);
    expect(updated.tz).to.be.eq(data.tz);
    expect(updated.price).to.be.not.eq(0);
    expect(updated.skills).to.be.not.eq('');
    expect(updated.phone).to.be.eq(data.phone);

    expect(updated.userName).to.eq(data.userName);
  }

  @test()
  async validationErrors() {
    const user = await this.userFixture.createUser();

    const data = {
      storeName: faker.company.companyName(),
    };

    const config = {
      url: `${this.url}/api/user`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      data,
    };

    try {
      await this.http.request(config);
    } catch (e: any) {
      expect(e.response.status).to.be.equal(400);
      expect(e.response.data.errors).to.have.length(1);
    }
  }

  @test()
  async changeEmailUser() {
    const user = await this.userFixture.createUser();

    const data = Object.assign({}, user, {
      email: faker.internet.email(),
    });

    const config = {
      url: `${this.url}/api/user`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      data,
    };

    const res = await this.http.request(config);

    expect(res.data).to.be.empty;
  }

  @test()
  async duplicatePhoneException() {
    const phoneA = this.faker.phone();
    const phoneB = this.faker.phone();
    const userA = await this.userFixture.createUserWithPhone(phoneA);
    const userB = await this.userFixture.createUserWithPhone(phoneB);

    userB.phone = userA.phone;

    const config = {
      url: `${this.url}/api/user`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(userB).accessToken,
      },
      data: userB,
    };

    let err = null;

    try {
      await this.http.request(config);
    } catch (e: any) {
      err = e;
    }

    expect(err.response.status).to.be.equal(400);
    expect(err.response.data.name).to.be.equal('BadRequestError');
    expect(err.response.data.errors[0].constraints.PhoneConstraint).to.be.equal(
      'Phone number already exists.'
    );
  }

  @test()
  async duplicateEmailException() {
    const emailA = faker.internet.email();
    const emailB = faker.internet.email();
    const userA = await this.userFixture.createWithEmailAndPassword(emailA);
    const userB = await this.userFixture.createWithEmailAndPassword(emailB);

    userB.email = userA.email;

    const config = {
      url: `${this.url}/api/user`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authenticator.getTokens(userB).accessToken,
      },
      data: userB,
    };

    let err = null;

    try {
      await this.http.request(config);
    } catch (e: any) {
      err = e;
    }

    expect(err.response.status).to.be.equal(400);
    expect(err.response.data.name).to.be.equal('BadRequestError');
    expect(err.response.data.errors[0].constraints.EmailConstraint).to.be.equal(
      'Email address is already taken'
    );
  }
}
