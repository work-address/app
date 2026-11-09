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

  /**
   * Sets the key only if nothing holds it, in one step, and says whether it
   * did: of any number of callers racing on one key, exactly one hears true.
   */
  public async setIfAbsent(
    key: string,
    value: unknown,
    expiryMilliseconds: number,
  ): Promise<boolean> {
    const client = await this.getConnectedClient()

    const reply = await client.set(key, JSON.stringify(value), {
      PX: expiryMilliseconds,
      NX: true,
    })
    await client.disconnect()

    return reply === 'OK'
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
