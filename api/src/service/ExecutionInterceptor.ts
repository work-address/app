import moment from 'moment';
import * as Sentry from '@sentry/node';

import RejectedExecutionException from '../exception/RejectedExecutionException';
import {AppConfig} from '../app/AppConfig';

export class ExecutionInterceptor {
  protected timerStarted: moment.Moment;
  protected timoutSeconds: number;
  protected counter: number;
  protected env: string;

  constructor(timoutSeconds: number) {
    this.env = AppConfig.getEnv();
    this.timoutSeconds = timoutSeconds;
    this.timerStarted = moment();
    this.counter = 0;
  }

  public getCounter(): number {
    return this.counter;
  }

  public rejectExecutionIfFrozen(message: string) {
    const diff = moment().diff(this.timerStarted, 'seconds');

    this.counter++;

    if (diff > this.timoutSeconds) {
      if (!['development', 'test'].includes(this.env)) {
        Sentry.captureException(message);
      }

      throw new RejectedExecutionException(message);
    }
  }
}
