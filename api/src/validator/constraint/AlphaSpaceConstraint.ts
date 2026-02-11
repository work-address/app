import {ValidatorConstraint, ValidatorConstraintInterface} from 'class-validator';

@ValidatorConstraint({name: 'AlphaSpaceConstraint', async: true})
export class AlphaSpaceConstraint implements ValidatorConstraintInterface {
  private message: string;

  validate(value: string) {
    if (!value) {
      return true;
    }

    const mask = /^[a-z][a-z\s]*$/;

    if (!mask.test(value.toLowerCase())) {
      this.message = 'First name can only contain letters (a-z) and spaces';

      return false;
    }

    return true;
  }

  defaultMessage() {
    return this.message;
  }
}
