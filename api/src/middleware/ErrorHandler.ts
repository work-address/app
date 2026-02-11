import {ExpressErrorMiddlewareInterface, Middleware} from 'routing-controllers';
import express from 'express';

import * as Sentry from '@sentry/node';
import {ErrorFormatter} from '../service/ErrorFormatter';

@Middleware({type: 'after'})
export class ErrorHandler implements ExpressErrorMiddlewareInterface {
  error(
    error: any,
    _request: express.Request,
    response: express.Response,
    _next: (err: any) => any
  ): void {
    const httpCode: number = error.httpCode || error.response?.status || 500;

    const errorFormatted = ErrorFormatter.format(error);

    this.captureSentry(httpCode, error);

    response.status(httpCode);
    response.send(errorFormatted);
  }

  private captureSentry(httpCode: number, error: any) {
    const isWarning = httpCode === 400 || httpCode === 401;

    if (isWarning) {
      Sentry.captureException(error, {level: Sentry.Severity.Warning});
    } else {
      Sentry.captureException(error, {level: Sentry.Severity.Error});
    }
  }
}
