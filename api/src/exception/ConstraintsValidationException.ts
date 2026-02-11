import {HttpError} from 'routing-controllers';
import {ValidationError} from 'class-validator/types/validation/ValidationError';

class ConstraintsValidationException extends HttpError {
  protected static NAME = 'ConstraintsValidationException';
  protected static MESSAGE = `Constraint validation error has occurred.`;
  protected violations: ValidationError[] = [];

  constructor(violations: ValidationError[]) {
    super(400, ConstraintsValidationException.MESSAGE);
    this.name = ConstraintsValidationException.NAME;

    this.violations = violations;
  }
}

export default ConstraintsValidationException;
