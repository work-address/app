import {createClient} from 'redis';
import {inject, injectable} from 'inversify';

import {IConfigParameters} from '../interface/IConfigParameters';

@injectable()
export class RedisClient {
  @inject('parameters')
  protected parameters: IConfigParameters;

  public async set(key: string, value: any) {
    const client = await this.getConnectedClient();

    await client.set(key, JSON.stringify(value));
    await client.disconnect();
  }

  public async setWithExpiry(key: string, value: any, expiryMilliseconds: number) {
    const client = await this.getConnectedClient();

    await client.set(key, JSON.stringify(value), {PX: expiryMilliseconds});
    await client.disconnect();
  }

  public async get(key: string): Promise<any | string> {
    const client = await this.getConnectedClient();
    const value = await client.get(key);

    await client.disconnect();

    if (value) {
      return JSON.parse(value);
    }

    return '';
  }

  private async getConnectedClient() {
    const client = createClient({
      url: this.parameters.redis,
    });

    await client.connect();

    return client;
  }
}
