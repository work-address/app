import 'reflect-metadata'
import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import nock from 'nock'

import AuthenticationException from '@/exception/authentication-exception'
import { IConfigParameters } from '@/model/config'
import { GoogleAuthProvider } from '@/service/auth/google-auth-provider'
import { GoogleAuthFixture } from '@/test/fixture/google-auth-fixture'

@suite()
export class GoogleAuthProviderTest {
  private provider: GoogleAuthProvider

  before() {
    this.provider = new GoogleAuthProvider()
    this.provider['parameters'] = {
      googleClientId: GoogleAuthFixture.clientId,
    } as IConfigParameters
    nock.disableNetConnect()
  }

  after() {
    const pending = nock.pendingMocks()
    nock.cleanAll()
    nock.enableNetConnect()
    expect(pending).to.be.empty
  }

  @test()
  async acceptsGoogleSignedCredentialAndCachesPublicKeys() {
    const certificates = GoogleAuthFixture.mockCertificates()
    const credential = GoogleAuthFixture.credential()

    const identity = await this.provider.verifyCredential(credential)
    const returningIdentity = await this.provider.verifyCredential(credential)

    expect(identity).to.deep.equal({
      sub: GoogleAuthFixture.subject,
      email: 'google-user@example.com',
      name: 'Google Test User',
    })
    expect(returningIdentity).to.deep.equal(identity)
    expect(certificates.isDone()).to.be.true
  }

  @test()
  async acceptsGoogleIssuerWithoutScheme() {
    GoogleAuthFixture.mockCertificates()
    const credential = GoogleAuthFixture.credential({
      iss: 'accounts.google.com',
      name: undefined,
    })

    const identity = await this.provider.verifyCredential(credential)

    expect(identity.sub).to.equal(GoogleAuthFixture.subject)
    expect(identity.name).to.be.undefined
  }

  @test()
  async rejectsCredentialSignedByAnotherKey() {
    GoogleAuthFixture.mockCertificates()
    await this.expectRejected(
      GoogleAuthFixture.credential({}, { invalidSignature: true }),
    )
  }

  @test()
  async rejectsCredentialWithUnknownSigningKey() {
    GoogleAuthFixture.mockCertificates()
    await this.expectRejected(
      GoogleAuthFixture.credential({}, { keyId: 'unknown-signing-key' }),
    )
  }

  @test()
  async rejectsCredentialForAnotherApp() {
    GoogleAuthFixture.mockCertificates()
    await this.expectRejected(
      GoogleAuthFixture.credential({ aud: 'another-client-id' }),
    )
  }

  @test()
  async rejectsCredentialFromAnotherIssuer() {
    GoogleAuthFixture.mockCertificates()
    await this.expectRejected(
      GoogleAuthFixture.credential({ iss: 'https://attacker.example.com' }),
    )
  }

  @test()
  async rejectsExpiredCredentialEvenWithinLibraryClockSkew() {
    GoogleAuthFixture.mockCertificates()
    await this.expectRejected(
      GoogleAuthFixture.credential({ exp: Math.floor(Date.now() / 1000) - 1 }),
    )
  }

  @test()
  async rejectsCredentialIssuedTooFarInTheFuture() {
    GoogleAuthFixture.mockCertificates()
    await this.expectRejected(
      GoogleAuthFixture.credential({
        iat: Math.floor(Date.now() / 1000) + 600,
      }),
    )
  }

  @test()
  async rejectsCredentialWithoutExpiry() {
    GoogleAuthFixture.mockCertificates()
    await this.expectRejected(GoogleAuthFixture.credential({ exp: undefined }))
  }

  @test()
  async rejectsCredentialWithoutSubject() {
    GoogleAuthFixture.mockCertificates()
    await this.expectRejected(GoogleAuthFixture.credential({ sub: undefined }))
  }

  @test()
  async rejectsCredentialWithNonStringSubject() {
    GoogleAuthFixture.mockCertificates()
    await this.expectRejected(GoogleAuthFixture.credential({ sub: 12345 }))
  }

  @test()
  async rejectsCredentialWithoutEmail() {
    GoogleAuthFixture.mockCertificates()
    await this.expectRejected(
      GoogleAuthFixture.credential({ email: undefined }),
    )
  }

  @test()
  async rejectsCredentialWithUnverifiedEmail() {
    GoogleAuthFixture.mockCertificates()
    await this.expectRejected(
      GoogleAuthFixture.credential({ email_verified: false }),
      'Google account email is not verified',
    )
  }

  @test()
  async requiresBooleanEmailVerificationClaim() {
    GoogleAuthFixture.mockCertificates()
    await this.expectRejected(
      GoogleAuthFixture.credential({ email_verified: 'true' }),
      'Google account email is not verified',
    )
  }

  @test()
  async rejectsMalformedCredentialWithoutExposingIt() {
    GoogleAuthFixture.mockCertificates()
    await this.expectRejected('malformed-sensitive-credential')
  }

  @test()
  async rejectsWhenCertificateServiceIsUnavailable() {
    nock(GoogleAuthFixture.certificateHost)
      .get(GoogleAuthFixture.certificatePath)
      .reply(400, { error: 'Certificate service is unavailable' })

    await this.expectRejected(GoogleAuthFixture.credential())
  }

  @test()
  async rejectsBlankCredentialBeforeFetchingCertificates() {
    await this.expectRejected('   ')
  }

  @test()
  async rejectsUnconfiguredSignInBeforeFetchingCertificates() {
    this.provider['parameters'].googleClientId = ''

    await this.expectRejected(
      GoogleAuthFixture.credential(),
      'Google sign-in is not configured',
    )
  }

  private async expectRejected(
    credential: string,
    message = 'Google credential is not valid',
  ): Promise<void> {
    let error: unknown

    try {
      await this.provider.verifyCredential(credential)
    } catch (caught) {
      error = caught
    }

    expect(error).to.be.instanceOf(AuthenticationException)
    expect((error as AuthenticationException).httpCode).to.equal(401)
    expect((error as Error).message).to.equal(
      `Authentication error: ${message}`,
    )
  }
}
