import {Connection} from 'typeorm';
import {Container} from 'inversify';
import {timeout} from '@testdeck/mocha';
import {AppConfig} from '../app/AppConfig';

import {DbConnector} from '../connector/DbConnector';
import {AppContainer} from '../app/AppContainer';
import {UserFixture} from './fixture/UserFixture';
import {IConfigParameters} from '../interface/IConfigParameters';
import {Faker} from '../service/Faker';

export class AbstractDatabaseIntegration {
  public conn: Connection;
  public container: Container;
  protected parameters: IConfigParameters;
  protected env: string;
  protected userFixture: UserFixture;

  protected faker: Faker;

  constructor() {
    const parameters = AppConfig.readConfig();

    this.env = AppConfig.getEnv();
    this.container = AppContainer.build(parameters, this.env);
    this.parameters = this.container.get('parameters');
    this.userFixture = this.container.get('UserFixture');
    this.faker = this.container.get('Faker');
  }

  @timeout(10000)
  async before() {
    const db = new DbConnector(this.parameters, this.env);

    this.conn = await db.connect();
  }

  async after() {
    await this.conn.close();
  }
}
