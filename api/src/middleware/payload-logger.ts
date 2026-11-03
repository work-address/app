import { ExpressMiddlewareInterface, Middleware } from 'routing-controllers'
import express from 'express'
import { RecordingPrivacy } from '@/service/recording-privacy'
import * as jwt from 'jsonwebtoken'

import { AppContainer } from '@/app/app-container'
import { Authenticator } from '@/service/auth/authenticator'
import { ILogger } from '@/model/logging'

@Middleware({ type: 'before' })
export class PayloadLogger implements ExpressMiddlewareInterface {
  public static redactCredentials(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => PayloadLogger.redactCredentials(item))
    }
    if (value === null || typeof value !== 'object') {
      return value
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /^(credential|password|signature|access[-_]?token|refresh[-_]?token|id[-_]?token|private[-_]?key)$/i.test(
          key,
        )
          ? '[REDACTED]'
          : PayloadLogger.redactCredentials(item),
      ]),
    )
  }

  use(
    request: express.Request,
    response: express.Response,
    next: express.NextFunction,
  ) {
    response.on('finish', () => {
      this.logRequest(request, response)
    })

    next()
  }

  private logRequest(request: express.Request, response: express.Response) {
    try {
      const logger = AppContainer.getContainer().get<ILogger>('ILogger')
      const authenticator =
        AppContainer.getContainer().get<Authenticator>('Authenticator')

      let user = {}

      const authorization = request.header('Authorization')
      if (authorization) {
        try {
          const { id } = authenticator.decodeJwtToken(
            authorization,
          ) as jwt.JwtPayload
          user = { id }
        } catch {
          // Invalid/expired token — still log the request without user context
        }
      }

      const dataToLog = Object.fromEntries(
        Object.entries({
          method: request.method,
          url: request.originalUrl,
          ip: request.ip,
          statusCode: response.statusCode,
          body: RecordingPrivacy.sensitive(request.originalUrl || request.path)
            ? undefined
            : PayloadLogger.redactCredentials(request.body),
          query: PayloadLogger.redactCredentials(request.query),
          user,
        }).filter(([_key, val]) => {
          return val !== null && typeof val === 'object'
            ? Object.keys(val).length > 0
            : Boolean(val) === true
        }),
      )

      logger.info('request data', dataToLog)
    } catch (error) {
      console.error('PayloadLogger failed', error)
    }
  }
}
