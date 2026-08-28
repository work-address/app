import { validate } from 'class-validator'
import { Effect } from 'effect'
import { inject, injectable } from 'inversify'

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
