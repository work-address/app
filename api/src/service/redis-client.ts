import { createClient } from 'redis'
import { inject, injectable } from 'inversify'

import { IConfigParameters } from '@/model/config'

@injectable()
export class RedisClient {
  @inject('parameters')
  protected parameters: IConfigParameters

  public async set(key: string, value: unknown) {
    const client = await this.getConnectedClient()

    await client.set(key, JSON.stringify(value))
    await client.disconnect()
  }

  public async setWithExpiry(
    key: string,
    value: unknown,
    expiryMilliseconds: number,
  ) {
    const client = await this.getConnectedClient()

    await client.set(key, JSON.stringify(value), { PX: expiryMilliseconds })
    await client.disconnect()
  }

  public async get(key: string): Promise<unknown | string> {
    const client = await this.getConnectedClient()
    const value = await client.get(key)

    await client.disconnect()

    if (value) {
      return JSON.parse(value)
    }

    return ''
  }

  /**
   * Counts one more event in the window `key` opened, atomically: the first
   * count opens a window of `windowMs`, and later ones add to it without
   * moving its end. Returns the count including this one and how long the
   * window has left. Shared by every replica, since they share this Redis.
   */
  public async countWithin(
    key: string,
    windowMs: number,
  ): Promise<{ count: number; ttlMs: number }> {
    const client = await this.getConnectedClient()

    try {
      const [, count, ttl] = await client
        .multi()
        .set(key, '0', { NX: true, PX: windowMs })
        .incr(key)
        .pTTL(key)
        .exec()

      return { count: Number(count), ttlMs: Math.max(0, Number(ttl)) }
    } finally {
      await client.disconnect()
    }
  }

  public async del(key: string): Promise<void> {
    const client = await this.getConnectedClient()

    await client.del(key)
    await client.disconnect()
  }

  private async getConnectedClient() {
    const client = createClient({
      url: this.parameters.redis,
    })

    await client.connect()

    return client
  }
}
