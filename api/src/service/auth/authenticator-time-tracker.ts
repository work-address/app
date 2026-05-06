import { inject, injectable } from 'inversify'
import moment from 'moment'

import { User } from '@/entity/user'
import { IConfigParameters } from '@/model/config'
import TimeTrackerException from '@/exception/time-tracker-exception'
import { RedisClient } from '@/service/redis-client'
import { Signer } from '@/service/auth/signer'
import { Authenticator } from '@/service/auth/authenticator'
import { EAuthTimeTrackerState, IAuthTokens } from '@/model/auth'
import { UserRepository } from '@/repository/user-repository'

export type TimeTrackerNonceCache = {
  ip: string
  state?: EAuthTimeTrackerState
  jwt?: IAuthTokens
}

function timeTrackerDataFromRedis(raw: unknown): TimeTrackerNonceCache | null {
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
    const nonce = this.signer.generateNonce()
    const key = `timetracker:nonce:${nonce}`
    const dataExisting = await this.redis.get(key)

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
    const nonceParsed = timeTrackerDataFromRedis(
      await this.redis.get(`timetracker:nonce:${nonce}`),
    )
    if (!nonceParsed) {
      throw new TimeTrackerException('The given nonce is not available')
    }
    const key = `timetracker:nonce:${nonce}`

    if (nonceParsed.ip !== ip) {
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
    const loginParsed = timeTrackerDataFromRedis(
      await this.redis.get(`timetracker:nonce:${nonce}`),
    )
    if (!loginParsed) {
      throw new TimeTrackerException('The given nonce is not available')
    }

    if (loginParsed.ip !== ip) {
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

    await this.userRepository.saveSingle(user)
  }

  public async timeTrackerNonceGet(nonce: string, ip: string) {
    const key = `timetracker:nonce:${nonce}`
    const data = timeTrackerDataFromRedis(await this.redis.get(key))

    if (!data) {
      throw new TimeTrackerException(
        'The given nonce is not available for log in',
      )
    }
    if (data.ip !== ip) {
      throw new TimeTrackerException('IP address mismatch')
    }

    return data
  }
}
