import {isNumber, ValidatorConstraint, ValidatorConstraintInterface} from 'class-validator';
import moment from 'moment';

@ValidatorConstraint({name: 'NumberOrDateConstraint', async: true})
export class NumberOrDateConstraint implements ValidatorConstraintInterface {
  private message: string = 'Value must be number or Date';

  validate(value: any) {
    if (isNumber(value) || moment.utc(value).isValid()) {
      return true;
    }

    return false;
  }

  defaultMessage() {
    return this.message;
  }
}
