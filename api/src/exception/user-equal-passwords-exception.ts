import {HttpError} from 'routing-controllers';

export class UserEqualPasswordsException extends HttpError {
  public static NAME = 'UserEqualPasswordsException';

  constructor(message: string) {
    super(400);

    this.name = UserEqualPasswordsException.NAME;
    this.message = message;
  }
}
