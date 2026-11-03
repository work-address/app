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
      const { roles } = user
      const edited = Object.assign(user, data)
      // Not editable, and the body's entity carries the class's empty default.
      edited.roles = roles
      // These have their own transactional endpoints. A stale profile save must
      // not overwrite a simultaneous agent or privacy-settings update.
      delete (edited as Partial<User>).agents
      delete (edited as Partial<User>).personalRedactionRules
      // Mail for a Google account goes to the address Google proved.
      if (user.googleSub) edited.email = null

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
