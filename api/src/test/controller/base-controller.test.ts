import { expect } from 'chai'
import nock from 'nock'
import { Container } from 'inversify'
import { timeout } from '@testdeck/mocha'

import { createClient, createConfig } from '@app/api-client'

import { App } from '@/app/app'
import { AppConfig } from '@/app/app-config'
import { AppContainer } from '@/app/app-container'
import { createAppTest } from '@/app/app-bootstrap'
import { IConfigParameters } from '@/model/config'
import { Http } from '@/service/http'
import { Faker } from '@/service/faker'

import { UserFixture } from '@/test/fixture/user-fixture'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { InvoiceFixture } from '@/test/fixture/invoice-fixture'
import { TimeFixture } from '@/test/fixture/time-fixture'
import { Authenticator } from '@/service/auth/authenticator'

export class BaseControllerTest {
  protected url: string
  protected app: App
  protected container: Container
  protected parameters: IConfigParameters
  protected http: Http
  protected faker: Faker
  protected authenticator: Authenticator

  protected projectFixture: ProjectFixture
  protected invoiceFixture: InvoiceFixture
  protected timeFixture: TimeFixture
  protected userFixture: UserFixture

  constructor() {
    const env = AppConfig.getEnv()
    const parameters = AppConfig.readConfig()

    this.container = AppContainer.build(parameters, env)
    this.parameters = this.container.get('parameters')
    this.http = this.container.get('Http')
    this.faker = this.container.get('Faker')

    this.authenticator = this.container.get('Authenticator')

    this.userFixture = this.container.get('UserFixture')
    this.projectFixture = this.container.get('ProjectFixture')
    this.timeFixture = this.container.get('TimeFixture')
    this.invoiceFixture = this.container.get('InvoiceFixture')

    this.url = `http://${this.parameters.host}:${this.parameters.port}`
  }

  protected apiClient() {
    return createClient(createConfig({ baseURL: this.url }))
  }

  protected expectEmptyResponseBody(data: unknown, message?: string): void {
    expect(
      data === null || data === '' || data === undefined,
      message ?? 'response body should be empty',
    ).to.be.true
  }

  @timeout(10000)
  async before() {
    this.app = createAppTest()
    await this.app.boostrap()
    this.app.start()
  }

  @timeout(10000)
  async after() {
    const pendedMocks = nock.pendingMocks()

    if (pendedMocks.length > 0) {
      console.log('There are pended mocks that should be removed')
      nock.cleanAll()
    }

    await this.app.stop()
  }
}
