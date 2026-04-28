import { ExpressMiddlewareInterface, Middleware } from 'routing-controllers'
import express from 'express'
import getDecorators from 'inversify-inject-decorators'
import { AppContainer } from '@/app/app-container'
import { Authenticator } from '@/service/auth/authenticator'
import * as jwt from 'jsonwebtoken'
import { ILogger } from '@/interface/logging'

const { lazyInject } = getDecorators(AppContainer.getContainer())

@Middleware({ type: 'after' })
export class PayloadLogger implements ExpressMiddlewareInterface {
  @lazyInject('ILogger')
  private logger: ILogger
  @lazyInject('Authenticator')
  private authenticator: Authenticator

  use(
    request: express.Request,
    _response: express.Response,
    _next: (err?: any) => any,
  ) {
    let user = {}

    const authorization = request.header('Authorization')
    if (authorization) {
      const { id, emailOrPhone } = this.authenticator.decodeJwtToken(
        authorization,
      ) as jwt.JwtPayload
      user = {
        id,
        emailOrPhone,
      }
    }

    const dataToLog = Object.fromEntries(
      Object.entries({
        body: request.body,
        url: request.originalUrl,
        query: request.query,
        user,
      }).filter(([_key, val]) => {
        return typeof val === 'object'
          ? Object.keys(val).length > 0
          : Boolean(val) === true
      }),
    )

    this.logger.info('request data', dataToLog)

    _next()
  }
}
