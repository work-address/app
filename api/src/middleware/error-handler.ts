import {
  ExpressErrorMiddlewareInterface,
  Middleware,
} from 'routing-controllers'
import express from 'express'

import * as Sentry from '@sentry/node'
import { ErrorFormatter } from '@/service/error-formatter'

@Middleware({ type: 'after' })
export class ErrorHandler implements ExpressErrorMiddlewareInterface {
  error(
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ): void {
    const err = error as {
      httpCode?: number
      response?: { status?: number }
      message?: string
      name?: string
    }
    const httpCode: number = err.httpCode || err.response?.status || 500

    const errorFormatted = ErrorFormatter.format(error)

    this.captureSentry(httpCode, error)

    // A 429 says when to come back; a client that honours it is not refused twice.
    const retryAfter = (error as { retryAfterSeconds?: unknown })
      .retryAfterSeconds

    if (typeof retryAfter === 'number') {
      response.setHeader('Retry-After', String(retryAfter))
    }

    response.status(httpCode)
    response.send(errorFormatted)
  }

  private captureSentry(httpCode: number, error: unknown) {
    const isWarning = httpCode === 400 || httpCode === 401

    if (isWarning) {
      Sentry.captureException(error, { level: 'warning' })
    } else {
      Sentry.captureException(error, { level: 'error' })
    }
  }
}
