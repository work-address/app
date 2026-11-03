import { inject, injectable } from 'inversify'
import { OAuth2Client, TokenPayload } from 'google-auth-library'

import { IConfigParameters } from '@/model/config'
import AuthenticationException from '@/exception/authentication-exception'

/** Validated identity extracted from a Google ID token. */
export interface IGoogleAuthPayload {
  sub: string
  email: string
  name?: string
}

@injectable()
export class GoogleAuthProvider {
  @inject('parameters')
  protected parameters: IConfigParameters

  // Reusing the client lets the library cache Google's rotating public keys
  // according to the certificate response's Cache-Control header.
  protected client = new OAuth2Client({
    transporterOptions: { timeout: 10_000 },
  })

  /**
   * Verifies the signature, issuer, audience and expiry with Google's official
   * library before using any identity claims. Verification errors never expose
   * the credential or the library's diagnostic token payload to the caller.
   */
  public async verifyCredential(
    credential: string,
  ): Promise<IGoogleAuthPayload> {
    const clientId = this.parameters.googleClientId.trim()

    if (!clientId) {
      throw new AuthenticationException('Google sign-in is not configured')
    }

    if (typeof credential !== 'string' || !credential.trim()) {
      throw new AuthenticationException('Google credential is not valid')
    }

    let payload: TokenPayload | undefined

    try {
      const ticket = await this.client.verifyIdToken({
        idToken: credential,
        audience: clientId,
      })

      payload = ticket.getPayload()
    } catch {
      throw new AuthenticationException('Google credential is not valid')
    }

    // The library allows clock skew. An already expired token must still be
    // rejected by our login endpoint, even inside that allowance.
    if (
      !payload ||
      payload.aud !== clientId ||
      !['accounts.google.com', 'https://accounts.google.com'].includes(
        payload.iss,
      ) ||
      typeof payload.exp !== 'number' ||
      !Number.isFinite(payload.exp) ||
      payload.exp <= Date.now() / 1000 ||
      typeof payload.sub !== 'string' ||
      !payload.sub.trim() ||
      typeof payload.email !== 'string' ||
      !payload.email.trim()
    ) {
      throw new AuthenticationException('Google credential is not valid')
    }

    if (payload.email_verified !== true) {
      throw new AuthenticationException('Google account email is not verified')
    }

    return {
      sub: payload.sub,
      email: payload.email,
      name: typeof payload.name === 'string' ? payload.name : undefined,
    }
  }
}
