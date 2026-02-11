import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  isEmail,
} from 'class-validator';
import {getRepository, Not} from 'typeorm';

import {User} from '../../entity/User';

@ValidatorConstraint({name: 'EmailOrPhoneConstraint', async: true})
export class EmailOrPhoneConstraint implements ValidatorConstraintInterface {
  private message: string;
  private isEmail: boolean;

  async validate(value: string, args: ValidationArguments) {
    const emailOrPhone = (args.object as User).emailOrPhone;
    this.isEmail = isEmail(emailOrPhone) ? true : false;

    // E.164 Notation for Phone Numbers
    const phonePattern = /^\+[0-9]{7,14}$/;

    if (emailOrPhone) {
      if (!this.isEmail && !phonePattern.test(emailOrPhone)) {
        this.message = "Phone number must start with a '+' symbol and be 7-15 digits.";
        return false;
      }

      return getRepository(User)
        .find({
          where: this.buildWhere(value, args),
        })
        .then(searchResult => {
          if (searchResult.length > 0) {
            this.message = this.isEmail
              ? 'Email address is already taken'
              : 'Phone is already taken';
            return false;
          }
          return true;
        });
    }
    this.message = 'emailOrPhone should not be empty';
    return false;
  }

  defaultMessage() {
    return this.message;
  }

  private buildWhere(value: string, args: ValidationArguments) {
    const userId = (args.object as any).id;
    const property = this.isEmail ? 'email' : 'phone';

    if (userId) {
      return {
        [property]: value,
        id: Not(userId),
      };
    }

    return {
      [property]: value,
    };
  }
}
