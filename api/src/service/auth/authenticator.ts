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
import {
  GoogleAuthProvider,
  IGoogleAuthPayload,
} from '@/service/auth/google-auth-provider'
import { AccountAddress } from '@/service/account-address'
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
  @inject('GoogleAuthProvider')
  protected googleAuthProvider: GoogleAuthProvider

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

  /**
   * Matches on Google's subject, because a mailbox can change hands: `address`
   * keeps the email it signed up with, and a later holder of that email has a
   * different subject and is refused rather than handed this account.
   */
  public loginGoogle(credential: string): AuthEffect<IAuthTokens> {
    return Effect.gen(this, function* () {
      const payload = yield* fromPromise(() =>
        this.googleAuthProvider.verifyCredential(credential),
      )
      const existing = yield* this.userRepository.findByGoogleSub(payload.sub)
      const user = existing ?? (yield* this.createGoogleUser(payload))

      return yield* Effect.sync(() => this.getTokens(user))
    })
  }

  private createGoogleUser(payload: IGoogleAuthPayload): AuthEffect<User> {
    const address = AccountAddress.toStorage(payload.email)

    return Effect.gen(this, function* () {
      const holder = yield* this.userRepository.findByAddressPublic(address)

      if (holder) {
        return yield* Effect.fail(
          new AuthenticationException(
            'This email already belongs to another account',
          ),
        )
      }

      const user = new User()
      user.address = address
      user.googleSub = payload.sub
      user.name = payload.name as string
      user.roles = [EUserRole.ROLE_USER]

      return yield* this.userManager.saveSingle(user)
    }).pipe(
      // A second tab can finish first. Its account has the same subject.
      Effect.catchAll((error) =>
        this.userRepository
          .findByGoogleSub(payload.sub)
          .pipe(
            Effect.flatMap((user) =>
              user ? Effect.succeed(user) : Effect.fail(error),
            ),
          ),
      ),
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

      // A refresh token has only an id, and must go through rotation rather
      // than work as a long-lived access token.
      if (!tokenData.address || !tokenData.id) {
        return null
      }

      return (
        (yield* this.userRepository.findOneBy({
          where: { id: tokenData.id },
        })) ?? null
      )
    }).pipe(
      // A malformed or expired token is not an error to this caller - it just
      // does not identify anyone. Defects are caught too because decodeJwtToken
      // throws rather than failing.
      Effect.catchAllCause(() => Effect.succeed(null)),
    )
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
