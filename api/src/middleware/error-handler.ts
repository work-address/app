import {
  ExpressErrorMiddlewareInterface,
  Middleware,
} from 'routing-controllers'
import express from 'express'
import { RecordingPrivacy } from '@/service/recording-privacy'

import * as Sentry from '@sentry/node'
import { AppContainer } from '@/app/app-container'
import { ILogger } from '@/model/logging'
import { ErrorFormatter } from '@/service/error-formatter'

@Middleware({ type: 'after' })
export class ErrorHandler implements ExpressErrorMiddlewareInterface {
  error(
    error: unknown,
    request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ): void {
    const err = error as {
      httpCode?: number
      status?: number
      response?: { status?: number }
      message?: string
      name?: string
    }
    const httpCode: number =
      err.httpCode ||
      err.response?.status ||
      (err.status && err.status >= 400 && err.status < 600 ? err.status : 500)

    // Mounted body parsers may leave path relative to their mount when they fail.
    const requestUrl = request.originalUrl || request.path
    const errorFormatted = RecordingPrivacy.ingest(requestUrl)
      ? {
          name: 'IngestError',
          message:
            httpCode === 413
              ? 'PAYLOAD_TOO_LARGE'
              : httpCode === 401
                ? 'INVALID_CREDENTIAL'
                : httpCode === 403
                  ? 'SCOPE_DENIED'
                  : httpCode === 429
                    ? 'RATE_LIMITED'
                    : httpCode === 503
                      ? 'AGENT_TRACKING_DISABLED'
                      : httpCode === 400
                        ? 'INVALID_ENVELOPE'
                        : 'INGEST_FAILED',
        }
      : ErrorFormatter.format(error)

    // Validation errors may include the rejected value. Keep private recording
    // data and redaction patterns out of third-party error reporting as well.
    if (!RecordingPrivacy.sensitive(requestUrl)) {
      this.captureSentry(httpCode, error)
    }

    if (!ErrorFormatter.expected(error)) {
      this.logUnexpected(error, requestUrl)
    }

    response.status(httpCode)
    response.send(errorFormatted)
  }

  /** The client no longer gets the text, and Sentry may be off or not told. */
  private logUnexpected(error: unknown, requestUrl: string) {
    try {
      AppContainer.getContainer()
        .get<ILogger>('ILogger')
        .error('unexpected error', {
          url: requestUrl,
          error: ErrorFormatter.forLog(
            error,
            RecordingPrivacy.sensitive(requestUrl),
          ),
        })
    } catch (failure) {
      console.error('ErrorHandler could not log', failure)
    }
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
