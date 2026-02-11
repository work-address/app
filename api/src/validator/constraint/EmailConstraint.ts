import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  isEmail,
} from 'class-validator';
import {getRepository, Not} from 'typeorm';

import {User} from '../../entity/User';

@ValidatorConstraint({name: 'EmailConstraint', async: true})
export class EmailConstraint implements ValidatorConstraintInterface {
  private message: string;

  validate(value: string, args: ValidationArguments) {
    const phone = (args.object as User).phone;
    const email = (args.object as User).email;

    if (email) {
      if (!isEmail(value)) {
        this.message = 'Email address is invalid.';
        return false;
      }

      return getRepository(User)
        .find({
          where: this.buildWhere(value, args),
        })
        .then(searchResult => {
          if (searchResult.length > 0) {
            this.message = 'Email address is already taken';
            return false;
          }
          return true;
        });
    }

    if (phone) {
      return true;
    }
    this.message = 'A phone or an email is required';
    return false;
  }

  defaultMessage() {
    return this.message;
  }

  private buildWhere(value: string, args: ValidationArguments) {
    const userId = (args.object as any).id;

    if (userId) {
      return {
        email: value,
        id: Not(userId),
      };
    }

    return {
      email: value,
    };
  }
}
