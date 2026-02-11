import {HttpError} from 'routing-controllers';

export class UserIncorrectOldPasswordException extends HttpError {
  public static NAME = 'UserIncorrectOldPasswordException';

  constructor(message: string) {
    super(400);

    this.name = UserIncorrectOldPasswordException.NAME;
    this.message = message;
  }
}
