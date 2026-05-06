import faker from 'faker'
import { expect } from 'chai'
import axios from 'axios'
import jwt from 'jsonwebtoken'
import * as web3 from 'web3'
import { suite, test } from '@testdeck/mocha'

import {
  authControllerLoginEth,
  authControllerNonce,
  authControllerRefresh,
  authControllerStatus,
} from '@app/api-client'

import { UserRepository } from '@/repository/user-repository'
import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { RedisClient } from '@/service/redis-client'
import { AuthenticatorTimeTracker } from '@/service/auth/authenticator-time-tracker'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeRepository } from '@/repository/time-repository'
import { IConfigParameters } from '@/model/config'
import moment from 'moment'

@suite()
export class AuthControllerTest extends BaseControllerTest {
  protected userRepository: UserRepository
  protected redisClient: RedisClient
  protected authenticatorTimeTracker: AuthenticatorTimeTracker
  protected projectRepository: ProjectRepository
  protected timeRepository: TimeRepository

  constructor() {
    super()

    this.redisClient = this.container.get('RedisClient')
    this.userRepository = this.container.get('UserRepository')
    this.projectRepository = this.container.get('ProjectRepository')
    this.timeRepository = this.container.get('TimeRepository')
  }

  @test()
  async loginEth() {
    const client = this.apiClient()
    const account = web3.eth.accounts.create()
    const nonce = await this.authenticator.getNonce(account.address)
    const signature = web3.eth.accounts.sign(nonce, account.privateKey)

    const res = await authControllerLoginEth({
      client,
      body: {
        signature: signature.signature,
        address: account.address,
      },
      throwOnError: true,
    })

    const user = await this.userRepository.findByAddressPublicOrFail(
      account.address,
    )
    const project = await this.projectRepository.findOneByOrFail({
      where: {
        user,
      },
    })
    const times = await this.timeRepository.findAllTimeForProject(project, user)

    const fromAt = moment().startOf('day').add(40, 'minutes')

    expect(res.status).to.be.equal(200)
    this.expectEmptyResponseBody(res.data)
    expect(res.headers).to.contain.keys(['authorization', 'refresh-token'])
    expect(project.title).to.be.equal('Your first project')
    expect(times.length).to.be.equal(5)
    expect(times[0].fromAt.toISOString()).to.be.equal(fromAt.toISOString())
  }

  @test()
  async loginEth_failsWhenNonceWasNeverRequested() {
    const client = this.apiClient()
    const account = web3.eth.accounts.create()
    const arbitraryPayload = 'not-a-server-issued-nonce'
    const signature = web3.eth.accounts.sign(
      arbitraryPayload,
      account.privateKey,
    )

    let error: unknown

    try {
      await authControllerLoginEth({
        client,
        body: {
          signature: signature.signature,
          address: account.address,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(401)
    expect(String(error.response?.data?.message ?? '')).to.match(/nonce/i)
  }

  @test()
  async loginEth_failsWhenSignatureDoesNotMatchAddress() {
    const client = this.apiClient()
    const accountA = web3.eth.accounts.create()
    const accountB = web3.eth.accounts.create()
    const nonce = await this.authenticator.getNonce(accountA.address)
    const signature = web3.eth.accounts.sign(nonce, accountB.privateKey)

    let error: unknown

    try {
      await authControllerLoginEth({
        client,
        body: {
          signature: signature.signature,
          address: accountA.address,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(401)
    expect(String(error.response?.data?.message ?? '')).to.match(/signature/i)
  }

  @test()
  async loginEth_failsValidationForEmptyFields() {
    const client = this.apiClient()

    let error: unknown

    try {
      await authControllerLoginEth({
        client,
        body: {
          signature: '',
          address: '',
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(400)
    expect(error.response?.data).to.have.property('errors')
  }

  @test()
  async nonce() {
    const client = this.apiClient()
    const account = web3.eth.accounts.create()

    const res = await authControllerNonce({
      client,
      body: {
        address: account.address,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data.length).to.be.eq(32)
  }

  @test()
  async nonce_failsValidationForEmptyAddress() {
    const client = this.apiClient()

    let error: unknown

    try {
      await authControllerNonce({
        client,
        body: { address: '' },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(400)
    expect(error.response?.data).to.have.property('errors')
  }

  @test()
  async refresh() {
    const client = this.apiClient()
    const user = await this.userFixture.createUser()

    const res = await authControllerRefresh({
      client,
      body: {
        refreshToken: this.authenticator.generateRefreshToken(user),
      },
      headers: {
        Authorization: '',
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    this.expectEmptyResponseBody(res.data)
    expect(res.headers).to.contain.keys(['authorization', 'refresh-token'])
  }

  @test()
  async refresh_failsWithMalformedRefreshToken() {
    const client = this.apiClient()

    let error: unknown

    try {
      await authControllerRefresh({
        client,
        body: { refreshToken: faker.datatype.uuid() },
        headers: { Authorization: '' },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(401)
    expect(String(error.response?.data?.message ?? '')).to.match(/valid/i)
  }

  @test()
  async refresh_failsValidationForEmptyRefreshToken() {
    const client = this.apiClient()

    let error: unknown

    try {
      await authControllerRefresh({
        client,
        body: { refreshToken: '' },
        headers: { Authorization: '' },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(400)
    expect(error.response?.data).to.have.property('errors')
  }

  @test()
  async refresh_failsWhenRefreshTokenUserIdDoesNotExist() {
    const client = this.apiClient()
    const parameters = this.container.get<IConfigParameters>('parameters')
    const refreshToken = jwt.sign(
      { id: faker.datatype.uuid() },
      parameters.jwtSecret,
      { expiresIn: '1d' },
    )

    let error: unknown

    try {
      await authControllerRefresh({
        client,
        body: { refreshToken },
        headers: { Authorization: '' },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(401)
    expect(String(error.response?.data?.message ?? '')).to.match(/exist/i)
  }

  @test()
  async status_user() {
    const client = this.apiClient()
    const user = await this.userFixture.createUser()
    const token = this.authenticator.generateJwtToken(user)

    const res = await authControllerStatus({
      client,
      headers: {
        Authorization: token,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data).to.have.property('id')
    expect(res.data).not.to.have.property('password')

    expect(res.data!.address).to.be.equal(user.address)
    expect(res.data!.email).to.be.equal(user.email)
    expect(res.data!.id).to.be.equal(user.id)
    expect(res.data!.roles).to.deep.equal(user.roles)
  }

  @test()
  async status_withoutAuthorizationHeader() {
    const client = this.apiClient()
    const res = await authControllerStatus({
      client,
      throwOnError: true,
    })

    expect([200, 204]).to.include(res.status)
    const body = res.data as unknown
    expect(body === null || body === '' || body === undefined).to.be.equal(
      true,
      'unauthenticated status should be empty body',
    )
  }

  @test()
  async status_invalidDoNotThrowException() {
    const client = this.apiClient()
    const token = faker.datatype.uuid()

    const res = await authControllerStatus({
      client,
      headers: {
        Authorization: token,
      },
      throwOnError: true,
    })

    expect([200, 204]).to.include(res.status)
    expect(res.data).to.be.equal('')
  }
}
