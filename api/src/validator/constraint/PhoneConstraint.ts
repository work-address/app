import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import {getRepository, Not} from 'typeorm';

import {User} from '../../entity/User';

@ValidatorConstraint({name: 'PhoneConstraint', async: true})
export class PhoneConstraint implements ValidatorConstraintInterface {
  private message: string;

  validate(value: string, args: ValidationArguments) {
    const phone = (args.object as User).phone;

    // E.164 Notation for Phone Numbers
    const phonePattern = /^\+[0-9]{7,14}$/;

    if (phone) {
      if (!phonePattern.test(phone)) {
        this.message = "Phone number must start with a '+' symbol and be 7-15 digits.";
        return false;
      }

      return getRepository(User)
        .find({
          where: this.buildWhere(value, args),
        })
        .then(searchResult => {
          if (searchResult.length > 0) {
            this.message = 'Phone number already exists.';
            return false;
          }
          return true;
        });
    }

    this.message = 'Phone number is required.';
    return false;
  }

  defaultMessage() {
    return this.message;
  }

  private buildWhere(value: string, args: ValidationArguments) {
    const userId = (args.object as any).id;

    if (userId) {
      return {
        phone: value,
        id: Not(userId),
      };
    }

    return {
      phone: value,
    };
  }
}
