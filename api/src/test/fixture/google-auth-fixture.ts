import { generateKeyPairSync, sign } from 'crypto'
import nock from 'nock'

interface IGoogleTestCredentialOptions {
  keyId?: string
  invalidSignature?: boolean
}

/** Local RSA keys only; no Google account or real credential is used. */
export class GoogleAuthFixture {
  public static readonly clientId =
    'test-google-client-id.apps.googleusercontent.com'
  public static readonly subject = '109876543210987654321'
  public static readonly certificateHost = 'https://www.googleapis.com'
  public static readonly certificatePath = '/oauth2/v1/certs'
  private static readonly keyId = 'test-google-signing-key'
  private static readonly keyPair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  private static readonly attackerKeyPair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })

  public static credential(
    overrides: Record<string, unknown> = {},
    options: IGoogleTestCredentialOptions = {},
  ): string {
    const now = Math.floor(Date.now() / 1000)
    const header = Buffer.from(
      JSON.stringify({
        alg: 'RS256',
        typ: 'JWT',
        kid: options.keyId ?? this.keyId,
      }),
    ).toString('base64url')
    const payload = Buffer.from(
      JSON.stringify({
        iss: 'https://accounts.google.com',
        aud: this.clientId,
        sub: this.subject,
        iat: now - 30,
        exp: now + 3600,
        email: 'google-user@example.com',
        email_verified: true,
        name: 'Google Test User',
        ...overrides,
      }),
    ).toString('base64url')
    const signed = `${header}.${payload}`
    const key = options.invalidSignature
      ? this.attackerKeyPair.privateKey
      : this.keyPair.privateKey
    const signature = sign('RSA-SHA256', Buffer.from(signed), key).toString(
      'base64url',
    )

    return `${signed}.${signature}`
  }

  public static certificates(): Record<string, string> {
    return { [this.keyId]: this.keyPair.publicKey }
  }

  public static mockCertificates(maxAge = 3600): nock.Scope {
    return nock(this.certificateHost)
      .get(this.certificatePath)
      .reply(200, this.certificates(), {
        'Cache-Control': `public, max-age=${maxAge}`,
      })
  }
}
