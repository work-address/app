import { expect } from 'chai'
import axios from 'axios'
import faker from 'faker'
import { suite, test } from '@testdeck/mocha'

import {
  authTimeTrackerControllerTimeTrackerConnect,
  authTimeTrackerControllerTimeTrackerLogin,
  authTimeTrackerControllerTimeTrackerNonceGenerate,
  authTimeTrackerControllerTimeTrackerNonceGet,
} from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { RedisClient } from '@/service/redis-client'
import { AuthenticatorTimeTracker } from '@/service/auth/authenticator-time-tracker'
import { EAuthTimeTrackerState } from '@/model/auth'

@suite()
export class AuthTimeTrackerControllerTest extends BaseControllerTest {
  protected redisClient: RedisClient
  protected authenticatorTimeTracker: AuthenticatorTimeTracker

  constructor() {
    super()

    this.redisClient = this.container.get('RedisClient')
    this.authenticatorTimeTracker = this.container.get(
      'AuthenticatorTimeTracker',
    )
  }

  @test()
  async timeTrackerNonceGenerate() {
    const ip = '127.0.0.1'
    const client = this.apiClient()
    const res = await authTimeTrackerControllerTimeTrackerNonceGenerate({
      client,
      throwOnError: true,
    })

    const nonce = res.data.nonce as string
    const key = `timetracker:nonce:${nonce}`
    const data = await this.redisClient.get(key)

    expect(res.status).to.be.equal(200)
    expect(nonce.length).to.be.eq(32)
    const cached = data as {
      nonce: string
      ip: string
      startAt: number
      state: EAuthTimeTrackerState
    }
    expect(cached).to.deep.include({
      nonce,
      ip,
      state: EAuthTimeTrackerState.INIT,
    })
    expect(cached.startAt).to.be.a('number')
  }

  @test()
  async timeTrackerNonceGet() {
    const ip = '127.0.0.1'
    const nonce =
      await this.authenticatorTimeTracker.timeTrackerNonceGenerate(ip)
    const user = await this.userFixture.createUser()
    const token = this.authenticator.generateJwtToken(user)

    const client = this.apiClient()
    const res = await authTimeTrackerControllerTimeTrackerNonceGet({
      client,
      path: { nonce: nonce.nonce },
      headers: {
        Authorization: token,
      },
      throwOnError: true,
    })

    const key = `timetracker:nonce:${nonce.nonce}`
    const data = await this.redisClient.get(key)

    expect(res.status).to.be.equal(200)
    expect(res.data).to.be.deep.equal(data)
  }

  @test()
  async timeTrackerLogin() {
    const ip = '127.0.0.1'
    const nonce =
      await this.authenticatorTimeTracker.timeTrackerNonceGenerate(ip)

    const client = this.apiClient()
    const res = await authTimeTrackerControllerTimeTrackerLogin({
      client,
      path: { nonce: nonce.nonce },
      body: { nonce: nonce.nonce },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    this.expectEmptyResponseBody(res.data)
  }

  @test()
  async timeTrackerConnect() {
    const ip = '127.0.0.1'
    const user = await this.userFixture.createUser()
    const token = this.authenticator.generateJwtToken(user)

    const nonce =
      await this.authenticatorTimeTracker.timeTrackerNonceGenerate(ip)
    await this.authenticatorTimeTracker.timeTrackerLogin(nonce.nonce, ip)

    const client = this.apiClient()
    const res = await authTimeTrackerControllerTimeTrackerConnect({
      client,
      path: { nonce: nonce.nonce },
      body: { nonce: nonce.nonce },
      headers: {
        Authorization: token,
      },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    this.expectEmptyResponseBody(res.data)
  }

  @test()
  async timeTrackerJwt() {
    const ip = '127.0.0.1'
    const user = await this.userFixture.createUser()
    const nonce =
      await this.authenticatorTimeTracker.timeTrackerNonceGenerate(ip)

    await this.authenticatorTimeTracker.timeTrackerLogin(nonce.nonce, ip)
    await this.authenticatorTimeTracker.timeTrackerConnect(
      nonce.nonce,
      user,
      ip,
    )

    const client = this.apiClient()
    const res = await authTimeTrackerControllerTimeTrackerNonceGet({
      client,
      path: { nonce: nonce.nonce },
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data.nonce).to.be.eq(nonce.nonce)
    expect(res.data.state).to.be.eq(EAuthTimeTrackerState.CONNECTED)
    expect(res.data.ip).to.be.eq(ip)
    expect(res.data).to.have.property('jwt')
  }

  @test()
  async timeTrackerLogin_unknownNonce() {
    const client = this.apiClient()
    const unknownNonce = faker.datatype.uuid()

    let error: unknown

    try {
      await authTimeTrackerControllerTimeTrackerLogin({
        client,
        path: { nonce: unknownNonce },
        body: { nonce: unknownNonce },
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
  async timeTrackerNonceGet_unknownNonce() {
    const client = this.apiClient()
    let error: unknown

    try {
      await authTimeTrackerControllerTimeTrackerNonceGet({
        client,
        path: { nonce: faker.datatype.uuid() },
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
  async timeTrackerConnect_requiresAuthorization() {
    const ip = '127.0.0.1'
    const nonce =
      await this.authenticatorTimeTracker.timeTrackerNonceGenerate(ip)
    await this.authenticatorTimeTracker.timeTrackerLogin(nonce.nonce, ip)

    let error: unknown

    try {
      await authTimeTrackerControllerTimeTrackerConnect({
        client: this.apiClient(),
        path: { nonce: nonce.nonce },
        body: { nonce: nonce.nonce },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(401)
  }
}
