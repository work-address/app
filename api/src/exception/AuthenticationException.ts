import {UnauthorizedError} from 'routing-controllers';

class AuthenticationException extends UnauthorizedError {
  public static NAME = 'AuthenticationException';

  constructor(message: string) {
    super(`Authentication error: ${message}`);

    Object.setPrototypeOf(this, AuthenticationException.prototype);
    this.name = AuthenticationException.NAME;
    this.message = `Authentication error: ${message}`;
  }
}

export default AuthenticationException;
