import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'
import { User } from '@/entity/user'

@ValidatorConstraint({ name: 'PhoneConstraint' })
export class PhoneConstraint implements ValidatorConstraintInterface {
  private message: string

  validate(_value: string, args: ValidationArguments) {
    const phone = (args.object as User).phone

    // E.164 Notation for Phone Numbers
    const phonePattern = /^\+[0-9]{7,14}$/

    if (phone) {
      if (!phonePattern.test(phone)) {
        this.message =
          "Phone number must start with a '+' symbol and be 7-15 digits."
        return false
      }

      return true
    }

    this.message = 'Phone number is required.'
    return false
  }

  defaultMessage() {
    return this.message
  }
}
