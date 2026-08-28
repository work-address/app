import { expect } from 'chai'
import * as web3 from 'web3'

import { suite, test } from '@testdeck/mocha'
import { UserRepository } from '@/repository/user-repository'
import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { User } from '@/entity/user'
import { EUserRole } from '@/model/user'
import { Signer } from '@/service/auth/signer'
import { runPromise } from '@/service/effect-bridge'

@suite()
export class UserRepositoryIntegrationTest extends AbstractDatabaseIntegration {
  protected userRepository: UserRepository
  protected signer: Signer

  constructor() {
    super()

    this.userRepository = this.container.get('UserRepository')
    this.signer = this.container.get('Signer')
  }

  @test()
  async create() {
    const user = new User()
    const account = web3.eth.accounts.create()

    user.address = account.address
    user.email = this.faker.email()

    const newUser = await runPromise(this.userRepository.saveSingle(user))

    expect(newUser).to.have.property('id')
    expect(newUser.email).to.be.equal(user.email)
    expect(newUser).to.have.property('createdAt')
    expect(newUser).to.have.property('updatedAt')
  }

  @test()
  async createAndFind() {
    const user = new User()
    const account = web3.eth.accounts.create()

    user.address = account.address
    user.email = this.faker.email()

    const newUser = await runPromise(this.userRepository.saveSingle(user))
    const foundUser = await runPromise(
      this.userRepository.findByEmailPhoneOrFail(user.email),
    )

    expect(newUser.id).to.be.eq(foundUser.id)
  }

  @test()
  async createAndDeleteAndFind() {
    const user = new User()
    const account = web3.eth.accounts.create()

    user.address = account.address
    user.email = this.faker.email()

    const newUser = await runPromise(this.userRepository.saveSingle(user))
    const removedUser = await runPromise(this.userRepository.remove(newUser))

    try {
      await runPromise(this.userRepository.findByEmailPhoneOrFail(user.email))
      expect.fail('expected rejection')
    } catch (e: unknown) {
      expect((e as Error).name).to.be.equal('EntityNotFoundError')
    }

    expect(newUser).to.have.property('id')
    expect(removedUser).to.have.property('id')
    expect(newUser.id).to.be.eq(removedUser.id)
  }

  @test()
  async findAndCount() {
    const user = await this.userFixture.createUser()

    const positiveA = await runPromise(
      this.userRepository.findAndCount({
        filter: {
          id: user.id,
        },
        sort: { createdAt: 'ASC' },
        page: 0,
      }),
    )
    const positiveB = await runPromise(
      this.userRepository.findAndCount({
        filter: {
          id: user.id,
          role: EUserRole.ROLE_USER,
        },
        sort: { createdAt: 'ASC' },
        page: 0,
      }),
    )

    expect(positiveA[1]).to.be.eq(1)
    expect(positiveB[1]).to.be.eq(1)
  }
}
