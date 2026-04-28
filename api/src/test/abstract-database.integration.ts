import { Connection } from 'typeorm'
import { Container } from 'inversify'
import { timeout } from '@testdeck/mocha'
import { AppConfig } from '../app/app-config'

import { DbConnector } from '../connector/db-connector'
import { AppContainer } from '../app/app-container'
import { UserFixture } from './fixture/user-fixture'
import { IConfigParameters } from '../interface/config'
import { Faker } from '../service/faker'

export class AbstractDatabaseIntegration {
  public conn: Connection
  public container: Container
  protected parameters: IConfigParameters
  protected env: string
  protected userFixture: UserFixture

  protected faker: Faker

  constructor() {
    const parameters = AppConfig.readConfig()

    this.env = AppConfig.getEnv()
    this.container = AppContainer.build(parameters, this.env)
    this.parameters = this.container.get('parameters')
    this.userFixture = this.container.get('UserFixture')
    this.faker = this.container.get('Faker')
  }

  @timeout(10000)
  async before() {
    const db = new DbConnector(this.parameters, this.env)

    this.conn = await db.connect()
  }

  async after() {
    await this.conn.close()
  }
}
