import {ValidatorConstraint, ValidatorConstraintInterface} from 'class-validator';
import {getRepository} from 'typeorm';

import {User} from '../../entity/User';

@ValidatorConstraint({name: 'UserNameExistConstraint', async: true})
export class UserNameExistConstraint implements ValidatorConstraintInterface {
  private message: string;

  validate(value: string) {
    if (!value) {
      this.message = 'userName is not valid';
      return false;
    }

    return getRepository(User)
      .createQueryBuilder('user')
      .where('user.userName = :userName', {userName: value})
      .getOne()
      .then(searchResult => {
        if (searchResult) {
          return true;
        }
        this.message = 'userName does not exist.';
        return false;
      });
  }

  defaultMessage() {
    return this.message;
  }
}
