import { inject, injectable } from 'inversify'
import moment from 'moment'

import { User } from '@/entity/user'
import { IConfigParameters } from '@/model/config'
import TimeTrackerException from '@/exception/time-tracker-exception'
import { RedisClient } from '@/service/redis-client'
import { Signer } from '@/service/auth/signer'
import { Authenticator } from '@/service/auth/authenticator'
import { ClientIp } from '@/service/auth/client-ip'
import { EAuthTimeTrackerState, IAuthTokens } from '@/model/auth'
import { UserRepository } from '@/repository/user-repository'
import { runPromise } from '@/service/effect-bridge'

export type TimeTrackerNonceCache = {
  ip: string
  state?: EAuthTimeTrackerState
  jwt?: IAuthTokens
}
@injectable()
export class AuthenticatorTimeTracker {
  @inject('parameters')
  protected parameters: IConfigParameters
  @inject('Signer')
  protected signer: Signer
  @inject('RedisClient')
  protected redis: RedisClient
  @inject('Authenticator')
  protected authenticator: Authenticator
  @inject('UserRepository')
  protected userRepository: UserRepository

  public async timeTrackerNonceGenerate(ip: string): Promise<{
    nonce: string
    startAt: number
    state: EAuthTimeTrackerState
    ip: string
  }> {
    ip = ClientIp.normalize(ip)
    const nonce = this.signer.generateNonce()
    const key = `timetracker:nonce:${nonce}`
    const dataExisting = await this.redis.get(key)

    // console.log('timeTrackerNonceGenerate >>>>>', ip)

    if (dataExisting !== '') {
      throw new TimeTrackerException('The given nonce already persisted')
    }

    const data = {
      nonce,
      ip,
      startAt: moment().unix(),
      state: EAuthTimeTrackerState.INIT,
    }

    await this.redis.setWithExpiry(key, data, Authenticator.nonceExpiresIn)

    return Promise.resolve(data)
  }

  public async timeTrackerLogin(nonce: string, ip: string) {
    ip = ClientIp.normalize(ip)
    const nonceParsed = this.timeTrackerDataFromRedis(
      await this.redis.get(`timetracker:nonce:${nonce}`),
    )
    if (!nonceParsed) {
      throw new TimeTrackerException('The given nonce is not available')
    }
    const key = `timetracker:nonce:${nonce}`

    // console.log('timeTrackerLogin', nonceParsed, nonce, ip)

    if (!ClientIp.sameClient(nonceParsed.ip, ip)) {
      throw new TimeTrackerException('IP address mismatch')
    }

    const data = {
      nonce,
      ip,
      state: EAuthTimeTrackerState.LOGIN,
    }

    await this.redis.setWithExpiry(key, data, Authenticator.nonceExpiresIn)
  }

  public async timeTrackerConnect(nonce: string, user: User, ip: string) {
    ip = ClientIp.normalize(ip)
    const loginParsed = this.timeTrackerDataFromRedis(
      await this.redis.get(`timetracker:nonce:${nonce}`),
    )
    if (!loginParsed) {
      throw new TimeTrackerException('The given nonce is not available')
    }

    // console.log('timeTrackerConnect', loginParsed, nonce, ip)

    if (!ClientIp.sameClient(loginParsed.ip, ip)) {
      throw new TimeTrackerException('IP address mismatch')
    }

    const key = `timetracker:nonce:${nonce}`
    const data = {
      nonce,
      ip,
      state: EAuthTimeTrackerState.CONNECTED,
      jwt: this.authenticator.getTokens(user),
    }

    await this.redis.setWithExpiry(key, data, Authenticator.nonceExpiresIn)

    await runPromise(this.userRepository.saveSingle(user))
  }

  public async timeTrackerNonceGet(nonce: string, ip: string) {
    ip = ClientIp.normalize(ip)
    const key = `timetracker:nonce:${nonce}`
    const data = this.timeTrackerDataFromRedis(await this.redis.get(key))

    if (!data) {
      throw new TimeTrackerException(
        'The given nonce is not available for log in',
      )
    }

    // console.log('timeTrackerNonceGet', data, nonce, ip)
    // console.log('>>>>>>', data.ip, 'ip', ip)

    if (!ClientIp.sameClient(data.ip, ip)) {
      throw new TimeTrackerException('IP address mismatch')
    }

    return data
  }

  private timeTrackerDataFromRedis(raw: unknown): TimeTrackerNonceCache | null {
    if (
      raw === '' ||
      raw == null ||
      typeof raw !== 'object' ||
      Array.isArray(raw)
    ) {
      return null
    }
    const o = raw as { ip?: unknown }
    if (typeof o.ip !== 'string') {
      return null
    }
    return raw as TimeTrackerNonceCache
  }
}
