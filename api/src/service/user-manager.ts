import { validate } from 'class-validator'
import { Effect } from 'effect'
import { inject, injectable } from 'inversify'
import { NotFoundError } from 'routing-controllers'

import { User } from '@/entity/user'
import ConstraintsValidationException from '@/exception/constraints-validation-exception'
import { UserRepository } from '@/repository/user-repository'
import { Mailer } from '@/service/mailer'
import { RepoEffect } from '@/repository/abstract-repository-template'
import { fromPromise } from '@/service/effect-bridge'

@injectable()
export class UserManager {
  @inject('UserRepository')
  protected userRepository: UserRepository
  @inject('Mailer')
  protected mailer: Mailer

  /**
   * `user`'s profile as `viewer` may see it: anyone, unless it is hidden, and
   * then only its holder. A hidden profile fails exactly as an address with
   * no account does, so a 404 never says that someone is there and hiding.
   */
  public readProfile(
    user: User,
    viewer: User | null,
  ): Effect.Effect<User, NotFoundError> {
    return this.isVisibleTo(user, viewer)
      ? Effect.succeed(user)
      : Effect.fail(new NotFoundError('User does not exist'))
  }

  public isVisibleTo(user: User, viewer: User | null): boolean {
    return user.visible !== false || viewer?.id === user.id
  }

  public saveSingle(user: User): RepoEffect<User> {
    return this.userRepository.saveSingle(user)
  }

  public editValidateAndSave(user: User, data: User): RepoEffect<User> {
    return Effect.gen(this, function* () {
      const edited = Object.assign(user, data)

      const errors = yield* fromPromise(() =>
        validate(edited, { groups: ['edit'] }),
      )

      if (errors.length) {
        return yield* Effect.fail(new ConstraintsValidationException(errors))
      }

      return yield* this.userRepository.saveSingle(edited)
    })
  }
}
