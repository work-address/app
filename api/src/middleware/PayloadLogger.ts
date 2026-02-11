import {ExpressMiddlewareInterface, Middleware} from 'routing-controllers';
import express from 'express';
import getDecorators from 'inversify-inject-decorators';
import {AppContainer} from '../app/AppContainer';
import {Authenticator} from '../service/auth/Authenticator';
import * as jwt from 'jsonwebtoken';
import {ILogger} from '../interface/ILogger';

const {lazyInject} = getDecorators(AppContainer.getContainer());

@Middleware({type: 'after'})
export class PayloadLogger implements ExpressMiddlewareInterface {
  @lazyInject('ILogger')
  private logger: ILogger;
  @lazyInject('Authenticator')
  private authenticator: Authenticator;

  use(request: express.Request, _response: express.Response, _next: (err?: any) => any) {
    let user = {};

    if (request.header('Authorization')) {
      const {id, emailOrPhone} = this.authenticator.decodeJwtToken(
        request.header('Authorization') as string
      ) as jwt.JwtPayload;
      user = {
        id,
        emailOrPhone,
      };
    }

    const dataToLog = Object.fromEntries(
      Object.entries({
        body: request.body,
        url: request.originalUrl,
        query: request.query,
        user,
      }).filter(([_key, val]) => {
        return typeof val === 'object' ? Object.keys(val).length > 0 : Boolean(val) === true;
      })
    );

    this.logger.info('request data', dataToLog);

    _next();
  }
}
