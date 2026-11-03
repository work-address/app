import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  isEmail,
} from 'class-validator'
import { User } from '@/entity/user'

@ValidatorConstraint({ name: 'EmailConstraint' })
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

      return true
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
}
