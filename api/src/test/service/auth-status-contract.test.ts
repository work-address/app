import { suite, test } from '@testdeck/mocha'
import axios from 'axios'
import { expect } from 'chai'
import { faker } from '@faker-js/faker'
import * as fs from 'fs'
import nock from 'nock'
import * as path from 'path'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { GoogleAuthFixture } from '@/test/fixture/google-auth-fixture'

/**
 * The sending half of the cross-repo contract in
 * `test/fixture/auth-status.contract.json`, duplicated in both repos: the
 * website reads `/auth/status` to sign people in and to mail them. `web` asserts
 * it reads these fields; this asserts `app` sends them.
 */
@suite()
export class AuthStatusContractTest extends BaseControllerTest {
  private originalClientId: string

  async before() {
    await super.before()
    this.originalClientId = this.parameters.googleClientId
    this.parameters.googleClientId = GoogleAuthFixture.clientId
  }

  async after() {
    this.parameters.googleClientId = this.originalClientId
    nock.cleanAll()
    await super.after()
  }

  private fixture(): { body: Record<string, unknown> } {
    return JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '../fixture/auth-status.contract.json'),
        'utf8',
      ),
    )
  }

  @test()
  async sendsEveryFieldTheWebsiteReadsForAGoogleAccount() {
    GoogleAuthFixture.mockCertificates()
    const address =
      `someone.${faker.string.alphanumeric(8)}@example.com`.toLowerCase()
    const signedIn = await axios.post(`${this.url}/api/auth/google`, {
      credential: GoogleAuthFixture.credential({
        sub: faker.string.numeric(21),
        name: 'Someone',
        email: address,
      }),
    })

    const { status, data } = await axios.get(`${this.url}/api/auth/status`, {
      headers: { Authorization: signedIn.headers.authorization },
    })

    expect(status).to.equal(200)
    for (const [field, value] of Object.entries(this.fixture().body)) {
      expect(data, field).to.have.property(field)
      expect(Array.isArray(data[field]), field).to.equal(Array.isArray(value))
      expect(typeof data[field], field).to.equal(typeof value)
    }
    expect(data.roles[0]).to.be.a('string')
    expect(data.contactEmail).to.equal(data.address)
    expect(data.address).to.equal(address)
  }
}
