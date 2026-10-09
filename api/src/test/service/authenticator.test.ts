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
import {
  buildSolanaAuthPayload,
  buildSolanaAuthPayloadWithInvalidSignature,
} from '@/test/fixture/solana-auth-fixture'
import {
  buildTonAuthPayload,
  buildTonAuthPayloadWithInvalidSignature,
  getTestTonDomain,
} from '@/test/fixture/ton-auth-fixture'
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
      expect((err as Error).name).to.be.eq('TokenExpiredError')
    }
  }

  @test()
  async getUserFromRefreshToken_failUserDoesNotExist() {
    const refreshToken = jwt.sign(
      { id: faker.number.int() },
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
  getEmailFromJwtOrThrowError_success() {
    const user = new User()
    user.email = faker.internet.email()

    const token = this.authenticator.generateJwtToken(user)
    const email = this.authenticator.getEmailOrPhoneOrThrowError(token)

    expect(user.email).to.be.equal(email)
  }

  @test()
  getEmailFromJwtOrThrowError_errorMalformed() {
    let error: Error | undefined
    const token = faker.string.uuid()

    try {
      this.authenticator.getEmailOrPhoneOrThrowError(token)
    } catch (e: unknown) {
      error = e as Error
    }

    expect(error).to.be.ok
    expect(error!.name).to.be.eq('JsonWebTokenError')
    expect(error!.message).to.be.eq('jwt malformed')
  }

  @test.skip()
  getEmailFromJwtOrThrowError_errorExpired() {
    let error: Error | undefined
    const oldToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbE9yUGhvbmUiOiJPbGdhNTBAeWFob28uY29tIiwiaWF0IjoxNzAzNTg5NzE4LCJleHAiOjE3MDM2MDA1MTh9.Y2De_m7g_ZLmugywlDseKLmPPnJqek_CJl1VIfJe-2o'

    try {
      this.authenticator.getEmailOrPhoneOrThrowError(oldToken)
    } catch (e: unknown) {
      error = e as Error
    }

    expect(error).to.be.ok
    expect(error!.name).to.be.eq('TokenExpiredError')
    expect(error!.message).to.be.eq('jwt expired')
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

  @test()
  async getTonNonce_storesNonceInRedis() {
    const nonce = await runPromise(this.authenticator.getTonNonce())
    const stored = await this.redisClient.get(`nonce:ton:${nonce}`)

    expect(nonce.length).to.be.eq(32)
    expect(stored).to.be.eq(nonce)
  }

  @test()
  async loginTon_registersNewUser() {
    const domain = getTestTonDomain(this.parameters)
    const nonce = await runPromise(this.authenticator.getTonNonce())
    const { payload } = await buildTonAuthPayload({ nonce, domain })

    const tokens = await runPromise(this.authenticator.loginTon(payload))
    const user = await runPromise(
      this.userRepository.findByAddressPublicOrFail(payload.address),
    )

    expect(tokens).to.contain.keys(['accessToken', 'refreshToken'])
    expect(user.address).to.be.eq(payload.address)
  }

  @test()
  async loginTon_logsInExistingUser() {
    const domain = getTestTonDomain(this.parameters)
    const nonce = await runPromise(this.authenticator.getTonNonce())
    const { payload } = await buildTonAuthPayload({ nonce, domain })

    const existingUser = await this.userFixture.createUser()
    existingUser.address = payload.address
    await runPromise(this.userRepository.saveSingle(existingUser))

    const tokens = await runPromise(this.authenticator.loginTon(payload))
    const user = await runPromise(
      this.userRepository.findByAddressPublicOrFail(payload.address),
    )

    expect(tokens).to.contain.keys(['accessToken', 'refreshToken'])
    expect(user.id).to.be.eq(existingUser.id)
  }

  @test()
  async loginTon_failsWhenNonceWasNeverRequested() {
    const domain = getTestTonDomain(this.parameters)
    const { payload } = await buildTonAuthPayload({
      nonce: 'never-issued-ton-nonce',
      domain,
    })

    let err: Error | null = null

    try {
      await runPromise(this.authenticator.loginTon(payload))
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
  async loginTon_failsWhenSignatureIsInvalid() {
    const domain = getTestTonDomain(this.parameters)
    const nonce = await runPromise(this.authenticator.getTonNonce())
    const payload = await buildTonAuthPayloadWithInvalidSignature({
      nonce,
      domain,
    })

    let err: Error | null = null

    try {
      await runPromise(this.authenticator.loginTon(payload))
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
  async loginTon_failsWhenNonceAlreadyConsumed() {
    const domain = getTestTonDomain(this.parameters)
    const nonce = await runPromise(this.authenticator.getTonNonce())
    const { payload } = await buildTonAuthPayload({ nonce, domain })

    await runPromise(this.authenticator.loginTon(payload))

    let err: Error | null = null

    try {
      await runPromise(this.authenticator.loginTon(payload))
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
  async loginSolana_registersNewUser() {
    const setup = buildSolanaAuthPayload({ nonce: 'setup' })
    const nonce = await runPromise(this.authenticator.getNonce(setup.address))
    const { address, signature } = buildSolanaAuthPayload({
      nonce,
      secretKey: setup.secretKey,
    })

    const tokens = await runPromise(
      this.authenticator.loginSolana(signature, address),
    )
    const user = await runPromise(
      this.userRepository.findByAddressPublicOrFail(address),
    )

    expect(tokens).to.contain.keys(['accessToken', 'refreshToken'])
    expect(user.address).to.be.eq(address)
  }

  @test()
  async loginSolana_logsInExistingUser() {
    const setup = buildSolanaAuthPayload({ nonce: 'setup' })
    const nonce = await runPromise(this.authenticator.getNonce(setup.address))
    const { address, signature } = buildSolanaAuthPayload({
      nonce,
      secretKey: setup.secretKey,
    })

    const existingUser = await this.userFixture.createUser()
    existingUser.address = address
    await runPromise(this.userRepository.saveSingle(existingUser))

    const tokens = await runPromise(
      this.authenticator.loginSolana(signature, address),
    )
    const user = await runPromise(
      this.userRepository.findByAddressPublicOrFail(address),
    )

    expect(tokens).to.contain.keys(['accessToken', 'refreshToken'])
    expect(user.id).to.be.eq(existingUser.id)
  }

  @test()
  async loginSolana_failsWhenNonceWasNeverRequested() {
    const { address, signature } = buildSolanaAuthPayload({
      nonce: 'never-issued-solana-nonce',
    })

    let err: Error | null = null

    try {
      await runPromise(this.authenticator.loginSolana(signature, address))
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
  async loginSolana_failsWhenSignatureIsInvalid() {
    const setup = buildSolanaAuthPayload({ nonce: 'setup' })
    const nonce = await runPromise(this.authenticator.getNonce(setup.address))
    const { address, signature } = buildSolanaAuthPayloadWithInvalidSignature({
      nonce,
      secretKey: setup.secretKey,
    })

    let err: Error | null = null

    try {
      await runPromise(this.authenticator.loginSolana(signature, address))
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
  async loginSolana_failsWhenNonceAlreadyConsumed() {
    const setup = buildSolanaAuthPayload({ nonce: 'setup' })
    const nonce = await runPromise(this.authenticator.getNonce(setup.address))
    const { address, signature } = buildSolanaAuthPayload({
      nonce,
      secretKey: setup.secretKey,
    })

    await runPromise(this.authenticator.loginSolana(signature, address))

    let err: Error | null = null

    try {
      await runPromise(this.authenticator.loginSolana(signature, address))
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
