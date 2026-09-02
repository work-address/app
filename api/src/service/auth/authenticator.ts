import * as bcrypt from 'bcrypt'
import * as jwt from 'jsonwebtoken'
import { Effect } from 'effect'
import { inject, injectable } from 'inversify'

import { User } from '@/entity/user'
import { Mailer } from '@/service/mailer'

import { IAuthTokenData } from '@/model/auth'
import { UserRepository } from '@/repository/user-repository'
import { EUserRole } from '@/model/user'
import { IAuthTokens } from '@/model/auth'
import { IConfigParameters } from '@/model/config'
import AuthenticationException from '@/exception/authentication-exception'
import { UserManager } from '@/service/user-manager'
import { RedisClient } from '@/service/redis-client'
import { Signer } from '@/service/auth/signer'
import { TimeRepository } from '@/repository/time-repository'
import { TonProofService } from '@/service/auth/ton-proof-service'
import { IAuthTonPayload } from '@/model/auth'
import { fromPromise } from '@/service/effect-bridge'

/**
 * Authentication fails in exactly one way the caller cares about, but the
 * repository underneath can fail in many, so the channel stays `unknown` and
 * the original exception reaches ErrorHandler untouched.
 */
export type AuthEffect<A> = Effect.Effect<A, unknown>

@injectable()
export class Authenticator {
  protected accessTokenExpiresIn: jwt.SignOptions['expiresIn'] = '20d'
  protected refreshTokenExpiresIn: jwt.SignOptions['expiresIn'] = '180d'

  public static nonceExpiresIn: number = 1000 * 60 * 10 // 10 minutes

  @inject('UserRepository')
  protected userRepository: UserRepository
  @inject('TimeRepository')
  protected timeRepository: TimeRepository
  @inject('UserManager')
  protected userManager: UserManager
  @inject('Mailer')
  protected mailer: Mailer
  @inject('parameters')
  protected parameters: IConfigParameters
  @inject('Signer')
  protected signer: Signer
  @inject('RedisClient')
  protected redis: RedisClient
  @inject('TonProofService')
  protected tonProofService: TonProofService

  public getNonce(address: string): AuthEffect<string> {
    // Effect.suspend: generating a nonce is a side effect, so it belongs to the
    // run rather than to building the effect. Without it, merely constructing
    // this effect would mint a nonce, and running it twice would store the same
    // one twice instead of issuing two.
    return Effect.suspend(() => {
      const nonce = this.signer.generateNonce()
      const key = `nonce:${address}`

      return fromPromise(() =>
        this.redis.setWithExpiry(key, nonce, Authenticator.nonceExpiresIn),
      ).pipe(Effect.as(nonce))
    })
  }

  public getTonNonce(): AuthEffect<string> {
    return Effect.suspend(() => {
      const nonce = this.signer.generateNonce()
      const key = `nonce:ton:${nonce}`

      return fromPromise(() =>
        this.redis.setWithExpiry(key, nonce, Authenticator.nonceExpiresIn),
      ).pipe(Effect.as(nonce))
    })
  }

  /**
   * The three wallet logins differ only in where the nonce is keyed and how the
   * signature is checked; everything after that - consume the nonce, find or
   * create the user, issue tokens - is identical, and used to be copied three
   * times. Expressing it once as an Effect keeps the two failure modes
   * (`AuthenticationException`) in the type instead of relying on each copy
   * remembering to throw them.
   *
   * `verify` is an Effect rather than a boolean so a verifier can be async
   * (TON reads the chain) without the shared pipeline caring which one it got.
   */
  private authenticateWithNonce(
    address: string,
    key: string,
    verify: (nonce: string) => Effect.Effect<boolean, unknown>,
  ): AuthEffect<IAuthTokens> {
    return Effect.gen(this, function* () {
      const nonce = yield* fromPromise(() => this.redis.get(key))

      if (typeof nonce !== 'string' || !nonce) {
        return yield* Effect.fail(
          new AuthenticationException('Nonce is not available or expired'),
        )
      }

      const isValid = yield* verify(nonce)

      if (!isValid) {
        return yield* Effect.fail(
          new AuthenticationException('Signature is not valid'),
        )
      }

      yield* fromPromise(() => this.redis.del(key))

      const existing = yield* this.userRepository.findByAddressPublic(address)
      const user = existing ?? (yield* this.createUser(address))

      return yield* Effect.sync(() => this.getTokens(user))
    })
  }

  public loginEth(signature: string, address: string): AuthEffect<IAuthTokens> {
    return this.authenticateWithNonce(address, `nonce:${address}`, (nonce) =>
      Effect.sync(() => this.signer.verify(nonce, signature, address)),
    )
  }

  public loginTon(payload: IAuthTonPayload): AuthEffect<IAuthTokens> {
    return this.authenticateWithNonce(
      payload.address,
      `nonce:ton:${payload.proof.payload}`,
      () => fromPromise(() => this.tonProofService.checkProof(payload)),
    )
  }

  public loginSolana(
    signature: string,
    address: string,
  ): AuthEffect<IAuthTokens> {
    return this.authenticateWithNonce(address, `nonce:${address}`, (nonce) =>
      Effect.sync(() => this.signer.verifySolana(nonce, signature, address)),
    )
  }

  public getUserFromRefreshToken(token: string): AuthEffect<User> {
    return Effect.gen(this, function* () {
      let payload: jwt.JwtPayload & Partial<IAuthTokenData>
      try {
        payload = this.decodeJwtToken(token)
      } catch (e) {
        if (e instanceof AuthenticationException) return yield* Effect.fail(e)
        if (e instanceof Error && e.name === 'TokenExpiredError') {
          return yield* Effect.fail(e)
        }
        return yield* Effect.fail(
          new AuthenticationException('Refresh token is not valid'),
        )
      }
      const userId = payload.id

      if (!userId) {
        return yield* Effect.fail(
          new AuthenticationException('Refresh token is not valid'),
        )
      }

      return yield* this.userRepository.findOneByIdOrFail(userId).pipe(
        // Any lookup failure here means the token names a user that is gone;
        // the caller only ever surfaced it as an auth error.
        Effect.catchAll(() =>
          Effect.fail(new AuthenticationException('User does not exist')),
        ),
      )
    })
  }

  public getUserFromJwtTokenOrThrowException(token: string): AuthEffect<User> {
    return Effect.gen(this, function* () {
      const user = yield* this.getUserFromJwtToken(token)

      if (!user) {
        return yield* Effect.fail(
          new AuthenticationException('invalid auth token'),
        )
      }

      return user
    })
  }

  public getUserFromJwtToken(token: string): AuthEffect<User | null> {
    return Effect.gen(this, function* () {
      const tokenData = this.decodeJwtToken(token)

      if (tokenData.emailOrPhone) {
        const user = yield* this.userRepository.findByEmailPhone(
          tokenData.emailOrPhone,
        )

        if (user) {
          return user
        }
      }
      if (tokenData.address) {
        const user = yield* this.userRepository.findByAddressPublic(
          tokenData.address,
        )

        if (user) {
          return user
        }
      }

      return null
    }).pipe(
      // A malformed or expired token is not an error to this caller - it just
      // does not identify anyone. Defects are caught too because decodeJwtToken
      // throws rather than failing.
      Effect.catchAllCause(() => Effect.succeed(null)),
    )
  }

  public getEmailOrPhoneOrThrowError(token: string): string {
    const tokenData = this.decodeJwtToken(token)

    return tokenData.emailOrPhone as string
  }

  public getJwtIatOrThrowError(token: string): string {
    const tokenData = this.decodeJwtToken(token)

    return String(tokenData.iat)
  }

  public decodeJwtToken(
    token: string,
  ): jwt.JwtPayload & Partial<IAuthTokenData> {
    const payload = jwt.verify(token, this.parameters.jwtSecret)
    if (typeof payload !== 'object' || payload === null) {
      throw new AuthenticationException('Invalid token payload')
    }
    return payload as jwt.JwtPayload & Partial<IAuthTokenData>
  }

  public getTokens(user: User): IAuthTokens {
    const accessToken = this.generateJwtToken(user)
    const refreshToken = this.generateRefreshToken(user)

    return { accessToken, refreshToken }
  }

  public generateRefreshToken(user: User): string {
    return jwt.sign({ id: user.id }, this.parameters.jwtSecret, {
      expiresIn: this.refreshTokenExpiresIn,
    })
  }

  public generateJwtToken(user: User): string {
    const data: IAuthTokenData = {
      id: user.id,
      address: user.address,
      emailOrPhone: user.email || user.phone,
    }

    return jwt.sign(data, this.parameters.jwtSecret, {
      expiresIn: this.accessTokenExpiresIn,
    })
  }

  public static hashPassword(plainPassword: string): string {
    return bcrypt.hashSync(plainPassword, 8)
  }

  private createUser(address: string): AuthEffect<User> {
    // Built inside the generator so each run creates its own User; hoisting it
    // would make a second run re-save the instance the first run persisted.
    // A new account starts empty: the dashboard's empty state walks the user
    // through creating their first project.
    return Effect.gen(this, function* () {
      const user = new User()
      user.address = address
      user.roles = [EUserRole.ROLE_USER]

      yield* this.userManager.saveSingle(user)

      return user
    })
  }
}
