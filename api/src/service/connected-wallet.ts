import { Effect } from 'effect'
import { inject, injectable } from 'inversify'
import { ForbiddenError } from 'routing-controllers'
import * as web3 from 'web3'

import { User } from '@/entity/user'
import AuthenticationException from '@/exception/authentication-exception'
import { AccountAddress } from '@/service/account-address'
import { Authenticator } from '@/service/auth/authenticator'
import { Signer } from '@/service/auth/signer'
import { fromPromise } from '@/service/effect-bridge'
import { RedisClient } from '@/service/redis-client'
import { UserRepository } from '@/repository/user-repository'

type ConnectEffect<A> = Effect.Effect<A, unknown>

/**
 * A Google account's proven wallet. Proving it takes a signature over a message
 * issued to this account for this purpose, kept apart from login nonces so that
 * a signature made to sign in can't be replayed here.
 */
@injectable()
export class ConnectedWallet {
  @inject('Signer')
  protected signer: Signer
  @inject('RedisClient')
  protected redis: RedisClient
  @inject('UserRepository')
  protected userRepository: UserRepository

  public message(user: User, address: string): ConnectEffect<string> {
    return this.requireGoogle(user).pipe(
      Effect.flatMap(() =>
        Effect.suspend(() => {
          const message = `Connect this wallet to your Work Address account.\n\nNonce: ${this.signer.generateNonce()}`

          return fromPromise(() =>
            this.redis.setWithExpiry(
              this.key(user, address),
              message,
              Authenticator.nonceExpiresIn,
            ),
          ).pipe(Effect.as(message))
        }),
      ),
    )
  }

  public connect(
    user: User,
    address: string,
    signature: string,
  ): ConnectEffect<User> {
    return Effect.gen(this, function* () {
      yield* this.requireGoogle(user)

      const key = this.key(user, address)
      const message = yield* fromPromise(() => this.redis.get(key))

      if (typeof message !== 'string' || !message) {
        return yield* Effect.fail(
          new AuthenticationException('Nonce is not available or expired'),
        )
      }

      const isValid = yield* Effect.try(() =>
        this.signer.verify(message, signature, address),
      ).pipe(Effect.orElseSucceed(() => false))

      if (!isValid) {
        return yield* Effect.fail(
          new AuthenticationException('Signature is not valid'),
        )
      }

      yield* fromPromise(() => this.redis.del(key))

      user.connectedWallet = web3.utils.toChecksumAddress(address)

      return yield* this.userRepository.saveSingle(user)
    })
  }

  public disconnect(user: User): ConnectEffect<User> {
    return this.requireGoogle(user).pipe(
      Effect.flatMap(() => {
        user.connectedWallet = null

        return this.userRepository.saveSingle(user)
      }),
    )
  }

  private requireGoogle(user: User): ConnectEffect<void> {
    return user.googleSub
      ? Effect.void
      : Effect.fail(
          new ForbiddenError('Only a Google account can connect a wallet'),
        )
  }

  private key(user: User, address: string): string {
    return `nonce:connect:${user.id}:${AccountAddress.toCanonical(address)}`
  }
}
