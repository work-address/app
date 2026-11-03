import { faker } from '@faker-js/faker'
import { expect } from 'chai'
import axios, { AxiosResponse } from 'axios'
import nock from 'nock'
import * as web3 from 'web3'
import { suite, test } from '@testdeck/mocha'
import { authControllerMethods, authControllerStatus } from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { UserRepository } from '@/repository/user-repository'
import { runPromise } from '@/service/effect-bridge'
import { GoogleAuthFixture } from '@/test/fixture/google-auth-fixture'

@suite()
export class AuthGoogleControllerTest extends BaseControllerTest {
  protected userRepository: UserRepository
  private originalClientId: string
  private certificates?: nock.Scope

  constructor() {
    super()
    this.userRepository = this.container.get('UserRepository')
  }

  async before() {
    await super.before()
    this.originalClientId = this.parameters.googleClientId
    this.parameters.googleClientId = GoogleAuthFixture.clientId
    this.certificates = undefined
  }

  async after() {
    this.parameters.googleClientId = this.originalClientId
    // Controllers may survive successive test app starts and retain Google's
    // cached keys, so a later valid login need not fetch certificates again.
    nock.cleanAll()
    await super.after()
  }

  private postGoogle(credential: unknown): Promise<AxiosResponse> {
    return axios.post(
      `${this.url}/api/auth/google`,
      { credential },
      { validateStatus: () => true },
    )
  }

  private credential(overrides: Record<string, unknown> = {}): string {
    this.certificates ??= GoogleAuthFixture.mockCertificates().persist()
    return GoogleAuthFixture.credential({
      sub: faker.string.numeric(21),
      ...overrides,
    })
  }

  @test()
  async loginGoogle_createsAnAccountCalledByItsEmail() {
    const sub = faker.string.numeric(21)
    const name = faker.person.fullName()
    const email = `Someone.${faker.string.alphanumeric(8)}@Example.com`

    const response = await this.postGoogle(
      this.credential({ sub, name, email }),
    )

    expect(response.status).to.equal(200)
    this.expectEmptyResponseBody(response.data)
    expect(response.headers).to.contain.keys(['authorization', 'refresh-token'])

    const user = await runPromise(
      this.userRepository.findByAddressPublicOrFail(email.toLowerCase()),
    )
    expect(user.googleSub).to.equal(sub)
    expect(user.name).to.equal(name)
    expect(user.email).to.be.null

    const status = await authControllerStatus({
      client: this.apiClient(),
      headers: { Authorization: response.headers.authorization },
      throwOnError: true,
    })

    expect(status.data!.id).to.equal(user.id)
    expect(status.data!.contactEmail).to.equal(email.toLowerCase())
    expect(status.data).to.not.have.property('googleSub')
  }

  @test()
  async loginGoogle_returnsToTheSameAccountByItsSubject() {
    const sub = faker.string.numeric(21)
    const email = faker.internet.email().toLowerCase()

    await this.postGoogle(this.credential({ sub, email }))
    // Google lets an account change its email; the account here keeps its name.
    const response = await this.postGoogle(
      this.credential({ sub, email: faker.internet.email() }),
    )

    expect(response.status).to.equal(200)

    const user = await runPromise(this.userRepository.findByGoogleSub(sub))
    expect(user!.address).to.equal(email)
  }

  /** A reassigned mailbox doesn't inherit the account of its last holder. */
  @test()
  async loginGoogle_refusesAnEmailHeldUnderAnotherSubject() {
    const email = faker.internet.email().toLowerCase()

    await this.postGoogle(this.credential({ email }))
    const response = await this.postGoogle(this.credential({ email }))

    expect(response.status).to.equal(401)
    expect(response.data.name).to.equal('GoogleEmailTakenException')
  }

  /** The sign-in page tells these apart, so each keeps its own name. */
  @test()
  async loginGoogle_namesWhyItRefused() {
    const unverified = await this.postGoogle(
      this.credential({ email_verified: false }),
    )
    const invalid = await this.postGoogle(
      this.credential({ aud: 'another-client' }),
    )

    expect(unverified.status).to.equal(401)
    expect(unverified.data.name).to.equal('GoogleEmailUnverifiedException')
    expect(invalid.status).to.equal(401)
    expect(invalid.data.name).to.equal('AuthenticationException')
  }

  /** Google accounts and wallet accounts are never linked. */
  @test()
  async loginGoogle_staysApartFromAWalletAccountWithThatEmail() {
    const email = faker.internet.email().toLowerCase()
    const wallet = await this.userFixture.createWithEmailAndPassword(email)

    const response = await this.postGoogle(this.credential({ email }))

    expect(response.status).to.equal(200)

    const google = await runPromise(
      this.userRepository.findByAddressPublicOrFail(email),
    )
    expect(google.id).to.not.equal(wallet.id)
  }

  @test()
  async loginGoogle_refusesWhatGoogleDidNotProve() {
    for (const credential of [
      this.credential({ email_verified: false }),
      this.credential({ aud: 'another-client' }),
      this.credential({ exp: Math.floor(Date.now() / 1000) - 3600 }),
      GoogleAuthFixture.credential({}, { invalidSignature: true }),
      'not-a-token',
    ]) {
      const response = await this.postGoogle(credential)

      expect(response.status).to.equal(401)
    }
  }

  @test()
  async loginGoogle_isRefusedWhereGoogleIsNotConfigured() {
    this.parameters.googleClientId = ''

    const response = await this.postGoogle(this.credential())

    expect(response.status).to.equal(401)
  }

  @test()
  async methods_offersGoogleWithItsClientId() {
    const res = await authControllerMethods({
      client: this.apiClient(),
      throwOnError: true,
    })

    expect(res.data!.googleClientId).to.equal(GoogleAuthFixture.clientId)
  }

  @test()
  async methods_offersOnlyTheWalletWithoutAClientId() {
    this.parameters.googleClientId = ''

    const res = await authControllerMethods({
      client: this.apiClient(),
      throwOnError: true,
    })

    expect(res.data).to.not.have.property('googleClientId')
  }

  /** Only Google may put an email in `address`. */
  @test()
  async walletLogin_refusesAnEmailAsItsAddress() {
    const user = await this.userFixture.createGoogleUser()

    for (const [path, body] of [
      ['nonce', { address: user.address }],
      ['eth', { address: user.address, signature: '0x00' }],
    ] as const) {
      const response = await axios.post(`${this.url}/api/auth/${path}`, body, {
        validateStatus: () => true,
      })

      expect(response.status, path).to.equal(400)
    }
  }

  @test()
  async tonAndSolanaRoutesAreGone() {
    for (const path of ['ton', 'ton/nonce', 'solana']) {
      const response = await axios.post(
        `${this.url}/api/auth/${path}`,
        { address: web3.eth.accounts.create().address, signature: 'x' },
        { validateStatus: () => true },
      )

      expect(response.status, path).to.equal(404)
    }
  }
}
