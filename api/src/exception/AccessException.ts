import {UnauthorizedError} from 'routing-controllers';

class AccessException extends UnauthorizedError {
  public static NAME = 'UserAccessException';

  constructor(message: string = "The data can't be accessed by your user") {
    super(`Access error: ${message}`);

    Object.setPrototypeOf(this, AccessException.prototype);
    this.name = AccessException.NAME;
    this.message = `Access error: ${message}`;
  }
}

export default AccessException;
