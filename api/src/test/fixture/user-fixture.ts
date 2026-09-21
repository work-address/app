import { inject, injectable } from 'inversify'
import { faker } from '@faker-js/faker'
import * as web3 from 'web3'

import { User } from '@/entity/user'
import { EUserRole } from '@/model/user'

import { UserRepository } from '@/repository/user-repository'
import { Signer } from '@/service/auth/signer'
import { UserManager } from '@/service/user-manager'
import { Faker } from '@/service/faker'
import { runPromise } from '@/service/effect-bridge'
import { RetentionJob } from '@/service/retention-job'

@injectable()
export class UserFixture {
  @inject('UserRepository')
  protected userRepository: UserRepository
  @inject('Signer')
  protected signer: Signer
  @inject('UserManager')
  protected userManager: UserManager
  @inject('Faker')
  protected faker: Faker

  public async createWithEmailAndPassword(email: string): Promise<User> {
    const account = web3.eth.accounts.create()
    const user = new User()

    user.address = account.address
    user.email = email
    user.roles = [EUserRole.ROLE_USER]
    user.tz = 'UTC'

    return runPromise(this.userManager.saveSingle(user))
  }

  public async createWithPhoneAndPassword(phone: string): Promise<User> {
    const account = web3.eth.accounts.create()
    const user = new User()

    user.address = account.address

    user.phone = phone
    user.tz = 'UTC'
    user.roles = [EUserRole.ROLE_USER]

    return runPromise(this.userManager.saveSingle(user))
  }

  public createUser(): Promise<User> {
    const account = web3.eth.accounts.create()
    const user = new User()

    const email = this.faker.email()

    user.address = account.address
    user.tz = 'UTC'
    user.rate = 0
    user.email = email
    user.roles = [EUserRole.ROLE_USER]

    return runPromise(this.userManager.saveSingle(user))
  }

  /** Premium governs retention only: use this for a project owner whose
   *  entries must outlive the free window. Collaborators need no plan. */
  public async createPremiumUser(): Promise<User> {
    const user = await this.createUser()

    user.premium = true

    return runPromise(this.userManager.saveSingle(user))
  }

  /**
   * Marks the owner as told of rotation `daysAgo` days before `now`: long
   * enough ago, by default, that their expired history may rotate (DEC-05).
   */
  public async tellOfRotation(
    user: User,
    now: Date = new Date(),
    daysAgo: number = RetentionJob.NOTICE_DAYS + 1,
  ): Promise<void> {
    await runPromise(
      this.userRepository.startRetentionNotice(
        user.id,
        new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
      ),
    )
  }

  public createUserFromKeypair(
    keypair: web3.Web3BaseWalletAccount,
  ): Promise<User> {
    const user = new User()

    const email = this.faker.email()

    user.address = keypair.address
    user.tz = 'UTC'
    user.email = email
    user.roles = [EUserRole.ROLE_USER]

    return runPromise(this.userManager.saveSingle(user))
  }

  public createUserWithPhone(phone: string): Promise<User> {
    const account = web3.eth.accounts.create()
    const user = new User()

    user.address = account.address
    user.tz = 'UTC'
    user.phone = phone
    user.roles = [EUserRole.ROLE_USER]

    return runPromise(this.userManager.saveSingle(user))
  }

  public validatedPassword(): string {
    return `${faker.internet
      .password({ length: 10 })
      .toLowerCase()}${faker.string
      .alpha({ length: 2 })
      .toUpperCase()}_!${faker.number.int(9)}`
  }
}
