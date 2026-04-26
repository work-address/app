import {UnauthorizedError} from 'routing-controllers';

class TimeTrackerException extends UnauthorizedError {
  public static NAME = 'TimeTrackerException';

  constructor(message: string) {
    super(message);

    Object.setPrototypeOf(this, TimeTrackerException.prototype);
    this.name = TimeTrackerException.NAME;
    this.message = message;
  }
}

export default TimeTrackerException;
