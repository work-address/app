import { ExpressMiddlewareInterface, Middleware } from 'routing-controllers'
import express from 'express'
import * as jwt from 'jsonwebtoken'

import { AppContainer } from '@/app/app-container'
import { Authenticator } from '@/service/auth/authenticator'
import { ILogger } from '@/model/logging'

@Middleware({ type: 'before' })
export class PayloadLogger implements ExpressMiddlewareInterface {
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
          const { id, emailOrPhone } = authenticator.decodeJwtToken(
            authorization,
          ) as jwt.JwtPayload
          user = {
            id,
            emailOrPhone,
          }
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
          body: request.body,
          query: request.query,
          user,
        }).filter(([_key, val]) => {
          return typeof val === 'object'
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
