import { suite, test } from '@testdeck/mocha'
import { faker } from '@faker-js/faker'
import { expect } from 'chai'
import * as jwt from 'jsonwebtoken'
import * as web3 from 'web3'

import { Authenticator } from '@/service/auth/authenticator'
import { User } from '@/entity/user'
import { UserFixture } from '@/test/fixture/user-fixture'
import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { UserRepository } from '@/repository/user-repository'
import { RedisClient } from '@/service/redis-client'
import { runPromise } from '@/service/effect-bridge'

@suite()
export class AuthenticatorTest extends AbstractDatabaseIntegration {
  protected authenticator: Authenticator
  protected userFixture: UserFixture
  protected userRepository: UserRepository
  protected redisClient: RedisClient

  constructor() {
    super()

    this.authenticator = this.container.get('Authenticator')
    this.userRepository = this.container.get('UserRepository')
    this.userFixture = this.container.get('UserFixture')
    this.redisClient = this.container.get('RedisClient')
  }

  @test()
  async getUserFromJwtToken() {
    const email = faker.internet.email()
    const user = await this.userFixture.createWithEmailAndPassword(email)

    const token = this.authenticator.generateJwtToken(user)
    const userFromToken = await runPromise(
      this.authenticator.getUserFromJwtToken(token),
    )

    expect(userFromToken).to.not.eq(null)
    expect(userFromToken!.id).to.be.equal(user.id)
  }

  @test()
  async getUserFromJwtToken_afterEmailChange() {
    const email = faker.internet.email()
    const user = await this.userFixture.createWithEmailAndPassword(email)
    const token = this.authenticator.generateJwtToken(user)

    // email change
    const userUpdate = await runPromise(
      this.userRepository.findByEmailPhoneOrFail(email),
    )
    userUpdate.email = faker.internet.email()
    await runPromise(this.userRepository.saveSingle(userUpdate))

    const userFromToken = await runPromise(
      this.authenticator.getUserFromJwtToken(token),
    )

    expect(userFromToken).to.not.eq(null)
    expect(userFromToken!.id).to.be.equal(user.id)
  }

  /** Tokens resolve by id: whoever takes an old email doesn't get the token. */
  @test()
  async getUserFromJwtToken_doesNotFollowAnEmailToItsNextHolder() {
    const email = faker.internet.email()
    const first = await this.userFixture.createWithEmailAndPassword(email)
    const token = this.authenticator.generateJwtToken(first)

    first.email = faker.internet.email()
    await runPromise(this.userRepository.saveSingle(first))
    await this.userFixture.createWithEmailAndPassword(email)

    const userFromToken = await runPromise(
      this.authenticator.getUserFromJwtToken(token),
    )

    expect(userFromToken!.id).to.be.equal(first.id)
  }

  /** A refresh token has to go through rotation. */
  @test()
  async getUserFromJwtToken_refusesARefreshToken() {
    const user = await this.userFixture.createUser()
    const token = this.authenticator.generateRefreshToken(user)

    expect(await runPromise(this.authenticator.getUserFromJwtToken(token))).to
      .be.null
  }

  @test()
  generateJwtToken() {
    const user = new User()
    user.email = faker.internet.email()

    const token = this.authenticator.generateJwtToken(user)

    expect(token.split('.').length).to.be.equal(3)
  }

  @test()
  generateRefreshJwtToken() {
    const user = new User()
    user.id = faker.string.uuid()
    user.email = faker.internet.email()

    const refreshToken = this.authenticator.generateRefreshToken(user)

    const payload = jwt.verify(refreshToken, this.parameters.jwtSecret)

    expect(payload).to.include({ id: user.id })
    expect(payload).to.include.all.keys('exp', 'iat')
  }

  @test()
  async getUserFromRefreshToken_success() {
    const email = faker.internet.email()
    const user = await this.userFixture.createWithEmailAndPassword(email)

    const tokens = this.authenticator.getTokens(user)

    const userFromToken = await runPromise(
      this.authenticator.getUserFromRefreshToken(tokens.refreshToken),
    )

    expect(userFromToken.id).to.be.eq(user.id)
  }

  @test()
  async getUserFromRefreshToken_failNotValid() {
    const refreshToken = jwt.sign({ id: '' }, this.parameters.jwtSecret, {
      expiresIn: 60 * 60 * 24,
    })

    try {
      await runPromise(this.authenticator.getUserFromRefreshToken(refreshToken))
    } catch (err: unknown) {
      expect((err as Error).name).to.be.eq('AuthenticationException')
      expect((err as Error).message).to.be.eq(
        'Authentication error: Refresh token is not valid',
      )
    }
  }

  @test()
  async getUserFromRefreshToken_failExpired() {
    const date = new Date()
    const iat = Math.floor(
      new Date(date.setDate(date.getDate() - 1))
        .setHours(date.getHours() - 1)
        .valueOf() / 1000,
    )
    const refreshToken = jwt.sign(
      { id: faker.word.sample(), iat },
      this.parameters.jwtSecret,
      {
        expiresIn: 60 * 60 * 24,
      },
    )

    try {
      await runPromise(this.authenticator.getUserFromRefreshToken(refreshToken))
    } catch (err: unknown) {
      expect((err as Error).name).to.be.eq('AuthenticationException')
      expect((err as Error).message).to.be.eq(
        'Authentication error: Refresh token has expired',
      )
    }
  }

  @test()
  async getUserFromRefreshToken_failUserDoesNotExist() {
    const refreshToken = jwt.sign(
      { id: faker.string.uuid() },
      this.parameters.jwtSecret,
      {
        expiresIn: 60 * 60 * 24,
      },
    )

    try {
      await runPromise(this.authenticator.getUserFromRefreshToken(refreshToken))
    } catch (err: unknown) {
      expect((err as Error).name).to.be.eq('AuthenticationException')
      expect((err as Error).message).to.be.eq(
        'Authentication error: User does not exist',
      )
    }
  }

  @test()
  async loginWeb3_register() {
    const account = web3.eth.accounts.create()

    const nonce = await runPromise(this.authenticator.getNonce(account.address))
    const signature = web3.eth.accounts.sign(nonce, account.privateKey)
    const tokens = await runPromise(
      this.authenticator.loginEth(signature.signature, account.address),
    )

    const userDB = await runPromise(
      this.userRepository.findByAddressPublicOrFail(account.address),
    )

    expect(tokens).to.contain.keys(['accessToken', 'refreshToken'])
    expect(userDB.address).to.be.eq(account.address)
  }

  @test()
  async loginWeb3_login() {
    const account = web3.eth.accounts.create()
    const user = await this.userFixture.createUserFromKeypair(account)

    const nonce = await runPromise(this.authenticator.getNonce(user.address))
    const signature = web3.eth.accounts.sign(nonce, account.privateKey)
    const tokens = await runPromise(
      this.authenticator.loginEth(signature.signature, account.address),
    )

    const userDB = await runPromise(
      this.userRepository.findByAddressPublicOrFail(account.address),
    )

    expect(tokens).to.contain.keys(['accessToken', 'refreshToken'])
    expect(userDB.id).to.be.eq(user.id)
  }

  /** A casing is how an address is written, not a different wallet. */
  @test()
  async loginEth_sameWalletInAnyCasingIsOneAccount() {
    const account = web3.eth.accounts.create()
    const signIn = async (address: string) => {
      const nonce = await runPromise(this.authenticator.getNonce(address))
      const { signature } = web3.eth.accounts.sign(nonce, account.privateKey)
      const tokens = await runPromise(
        this.authenticator.loginEth(signature, address),
      )

      return this.authenticator.decodeJwtToken(tokens.accessToken).id
    }

    const asChecksum = await signIn(account.address)
    const asLowerCase = await signIn(account.address.toLowerCase())
    const asUpperCase = await signIn(
      `0x${account.address.slice(2).toUpperCase()}`,
    )

    expect(asLowerCase).to.be.eq(asChecksum)
    expect(asUpperCase).to.be.eq(asChecksum)
    const accounts = await runPromise(
      this.userRepository.accountsByAddress([account.address]),
    )
    expect([...accounts.values()].map(({ id }) => id)).to.deep.eq([asChecksum])
  }

  /** The first sign-in's casing does not become the account's address. */
  @test()
  async loginEth_storesANewWalletInItsChecksumCasing() {
    const account = web3.eth.accounts.create()
    const address = account.address.toLowerCase()
    const nonce = await runPromise(this.authenticator.getNonce(address))
    const { signature } = web3.eth.accounts.sign(nonce, account.privateKey)

    await runPromise(this.authenticator.loginEth(signature, address))

    const user = await runPromise(
      this.userRepository.findByAddressPublicOrFail(address),
    )
    expect(user.address).to.be.eq(account.address)
  }

  /** An account made in another casing before the lookup ignored casing. */
  @test()
  async loginEth_findsAnAccountStoredInAnotherCasing() {
    const account = web3.eth.accounts.create()
    const user = await this.userFixture.createUserFromKeypair(account)
    user.address = account.address.toLowerCase()
    await runPromise(this.userRepository.saveSingle(user))

    const nonce = await runPromise(this.authenticator.getNonce(account.address))
    const { signature } = web3.eth.accounts.sign(nonce, account.privateKey)
    const tokens = await runPromise(
      this.authenticator.loginEth(signature, account.address),
    )

    expect(this.authenticator.decodeJwtToken(tokens.accessToken).id).to.be.eq(
      user.id,
    )
  }

  /**
   * Where a wallet already has two accounts, each spelling keeps reaching the
   * one it always did, and any other spelling reaches the oldest.
   */
  @test()
  async findByAddressPublic_withDuplicateRows() {
    const account = web3.eth.accounts.create()
    const lowerCase = account.address.toLowerCase()
    const older = await this.userFixture.createUserFromKeypair(account)
    older.address = lowerCase
    await runPromise(this.userRepository.saveSingle(older))
    const newer = await this.userFixture.createUserFromKeypair(account)

    const find = (address: string) =>
      runPromise(this.userRepository.findByAddressPublicOrFail(address))

    expect((await find(account.address)).id).to.be.eq(newer.id)
    expect((await find(lowerCase)).id).to.be.eq(older.id)
    expect(
      (await find(`0x${account.address.slice(2).toUpperCase()}`)).id,
    ).to.be.eq(older.id)
  }

  @test()
  async getNonce_storesNonceInRedis() {
    const account = web3.eth.accounts.create()
    const nonce = await runPromise(this.authenticator.getNonce(account.address))
    const stored = await this.redisClient.get(`nonce:${account.address}`)

    expect(nonce.length).to.be.eq(32)
    expect(stored).to.be.eq(nonce)
  }

  @test()
  async loginEth_failsWhenNonceWasNeverRequested() {
    const account = web3.eth.accounts.create()
    const arbitraryPayload = 'not-a-server-issued-nonce'
    const signature = web3.eth.accounts.sign(
      arbitraryPayload,
      account.privateKey,
    )

    let err: Error | null = null

    try {
      await runPromise(
        this.authenticator.loginEth(signature.signature, account.address),
      )
    } catch (e: unknown) {
      err = e as Error
    }

    expect(err).to.not.eq(null)
    expect(err!.name).to.be.equal('AuthenticationException')
    expect(err!.message).to.be.equal(
      'Authentication error: Nonce is not available or expired',
    )
  }

  @test()
  async loginEth_failsWhenSignatureDoesNotMatchAddress() {
    const accountA = web3.eth.accounts.create()
    const accountB = web3.eth.accounts.create()
    const nonce = await runPromise(
      this.authenticator.getNonce(accountA.address),
    )
    const signature = web3.eth.accounts.sign(nonce, accountB.privateKey)

    let err: Error | null = null

    try {
      await runPromise(
        this.authenticator.loginEth(signature.signature, accountA.address),
      )
    } catch (e: unknown) {
      err = e as Error
    }

    expect(err).to.not.eq(null)
    expect(err!.name).to.be.equal('AuthenticationException')
    expect(err!.message).to.be.equal(
      'Authentication error: Signature is not valid',
    )
  }

  @test()
  async loginEth_failsWhenNonceAlreadyConsumed() {
    const account = web3.eth.accounts.create()
    const nonce = await runPromise(this.authenticator.getNonce(account.address))
    const signature = web3.eth.accounts.sign(nonce, account.privateKey)

    await runPromise(
      this.authenticator.loginEth(signature.signature, account.address),
    )

    let err: Error | null = null

    try {
      await runPromise(
        this.authenticator.loginEth(signature.signature, account.address),
      )
    } catch (e: unknown) {
      err = e as Error
    }

    expect(err).to.not.eq(null)
    expect(err!.name).to.be.equal('AuthenticationException')
    expect(err!.message).to.be.equal(
      'Authentication error: Nonce is not available or expired',
    )
  }

  @test()
  async loginWeb3_failsWhenSigningWithWrongKeyForAddress() {
    const accountA = web3.eth.accounts.create()
    const accountB = web3.eth.accounts.create()

    await runPromise(this.authenticator.getNonce(accountA.address))
    const signature = web3.eth.accounts.sign(
      'wrong-nonce-value',
      accountB.privateKey,
    )

    let err: Error | null = null

    try {
      await runPromise(
        this.authenticator.loginEth(signature.signature, accountB.address),
      )
    } catch (e: unknown) {
      err = e as Error
    }

    expect(err).to.not.eq(null)
    expect(err!.name).to.be.equal('AuthenticationException')
    expect(err!.message).to.be.equal(
      'Authentication error: Nonce is not available or expired',
    )
  }
}
