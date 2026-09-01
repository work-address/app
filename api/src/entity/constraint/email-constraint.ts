import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  isEmail,
} from 'class-validator'
import { Not } from 'typeorm'
import { getDataSource } from '@/connector/data-source'
import { User } from '@/entity/user'

@ValidatorConstraint({ name: 'EmailConstraint', async: true })
export class EmailConstraint implements ValidatorConstraintInterface {
  private message: string

  validate(value: string, args: ValidationArguments) {
    const phone = (args.object as User).phone
    const email = (args.object as User).email

    if (email) {
      if (!isEmail(value)) {
        this.message = 'Email address is invalid.'
        return false
      }

      // Uniqueness is only decidable against a known account. The request
      // body is validated before it is merged onto the current user, and at
      // that point the account's own row would read as a clash and refuse a
      // save that changed nothing about the email. The merged entity is
      // validated again with its id in UserManager, which is where the lookup
      // can exclude the right row.
      if (!(args.object as User).id) {
        return true
      }

      return getDataSource()
        .getRepository(User)
        .find({
          where: this.buildWhere(value, args),
        })
        .then((searchResult) => {
          if (searchResult.length > 0) {
            this.message = 'Email address is already taken'
            return false
          }
          return true
        })
    }

    if (phone) {
      return true
    }
    this.message = 'A phone or an email is required'
    return false
  }

  defaultMessage() {
    return this.message
  }

  private buildWhere(value: string, args: ValidationArguments) {
    return {
      email: value,
      id: Not((args.object as User).id),
    }
  }
}
