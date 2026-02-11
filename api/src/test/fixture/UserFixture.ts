import {inject, injectable} from 'inversify';
import faker from 'faker';
import * as web3 from 'web3';

import {User} from '../../entity/User';
import {EUserRole} from '../../interface/EUserRole';

import {UserRepository} from '../../repository/UserRepository';
import {Signer} from '../../service/auth/Signer';
import {UserManager} from '../../service/UserManager';
import {Faker} from '../../service/Faker';

@injectable()
export class UserFixture {
  @inject('UserRepository')
  protected userRepository: UserRepository;
  @inject('Signer')
  protected signer: Signer;
  @inject('UserManager')
  protected userManager: UserManager;
  @inject('Faker')
  protected faker: Faker;

  public async createWithEmailAndPassword(email: string): Promise<User> {
    const account = web3.eth.accounts.create();
    const user = new User();

    user.address = account.address;
    user.email = email;
    user.emailOrPhone = email;
    user.roles = [EUserRole.ROLE_USER];
    user.tz = 'UTC';

    return this.userManager.saveSingle(user);
  }

  public async createWithPhoneAndPassword(phone: string): Promise<User> {
    const account = web3.eth.accounts.create();
    const user = new User();

    user.address = account.address;

    user.phone = phone;
    user.tz = 'UTC';
    user.roles = [EUserRole.ROLE_USER];

    return this.userManager.saveSingle(user);
  }

  public createUser(): Promise<User> {
    const account = web3.eth.accounts.create();
    const user = new User();

    const email = this.faker.email();

    user.address = account.address;
    user.tz = 'UTC';
    user.price = 0;
    user.email = email;
    user.emailOrPhone = email;
    user.roles = [EUserRole.ROLE_USER];

    return this.userManager.saveSingle(user);
  }

  public createUserFromKeypair(keypair: web3.Web3BaseWalletAccount): Promise<User> {
    const user = new User();

    const email = this.faker.email();

    user.address = keypair.address;
    user.tz = 'UTC';
    user.email = email;
    user.emailOrPhone = email;
    user.roles = [EUserRole.ROLE_USER];

    return this.userManager.saveSingle(user);
  }

  public createUserWithPhone(phone: string): Promise<User> {
    const account = web3.eth.accounts.create();
    const user = new User();

    user.address = account.address;
    user.tz = 'UTC';
    user.emailOrPhone = phone;
    user.phone = phone;
    user.roles = [EUserRole.ROLE_USER];

    return this.userManager.saveSingle(user);
  }

  public validatedPassword(): string {
    return `${faker.internet.password(10).toLowerCase()}${faker.random
      .alpha({count: 2})
      .toUpperCase()}_!${faker.datatype.number(9)}`;
  }
}
