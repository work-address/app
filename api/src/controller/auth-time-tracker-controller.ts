import {
  Post,
  JsonController,
  HttpCode,
  Get,
  Req,
  Res,
  Authorized,
  Param,
} from 'routing-controllers'

import express from 'express'
import { faker } from '@faker-js/faker'
import { OpenAPI } from 'routing-controllers-openapi'

import { CurrentUser } from '@/decorator/current-user'
import { User } from '@/entity/user'
import { App } from '@/app/app'
import { EUserRole } from '@/model/user'
import {
  AuthenticatorTimeTracker,
  type TimeTrackerNonceCache,
} from '@/service/auth/authenticator-time-tracker'
import { EAuthTimeTrackerState } from '@/model/auth'

@JsonController('/auth/timeTracker')
export class AuthTimeTrackerController {
  protected authenticatorTimeTracker: AuthenticatorTimeTracker

  constructor() {
    this.authenticatorTimeTracker = App.container.get(
      'AuthenticatorTimeTracker',
    )
  }

  @OpenAPI({
    summary: 'Start time-tracker auth: create nonce',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['nonce', 'startAt', 'state', 'ip'],
              properties: {
                nonce: { type: 'string' },
                startAt: { type: 'number' },
                state: { type: 'string' },
                ip: { type: 'string' },
              },
            },
          },
        },
      },
    },
  })
  @HttpCode(200)
  @Post('/nonce')
  public async timeTrackerNonceGenerate(@Req() req: express.Request): Promise<{
    nonce: string
    startAt: number
    state: EAuthTimeTrackerState
    ip: string
  }> {
    return await this.authenticatorTimeTracker.timeTrackerNonceGenerate(
      req.ip ?? '',
    )
  }

  @OpenAPI({
    summary: 'Time-tracker: complete login for nonce',
    requestBody: {
      content: {
        'application/json': {
          example: {
            nonce: faker.string.uuid(),
          },
          schema: {
            properties: {
              nonce: {
                type: 'string',
              },
            },
          },
        },
      },
      required: true,
    },
    responses: {
      200: {
        description: 'Success',
      },
    },
  })
  @HttpCode(200)
  @Post('/:nonce/login')
  public async timeTrackerLogin(
    @Param('nonce') nonce: string,
    @Req() req: express.Request,
    @Res() res: express.Response,
  ): Promise<express.Response> {
    await this.authenticatorTimeTracker.timeTrackerLogin(nonce, req.ip ?? '')

    res.end()
    return res
  }

  @OpenAPI({
    summary: 'Browser: link logged-in user to time-tracker session',
    requestBody: {
      content: {
        'application/json': {
          example: {
            nonce: faker.string.uuid(),
          },
          schema: {
            properties: {
              nonce: {
                type: 'string',
              },
            },
          },
        },
      },
      required: true,
    },
    responses: {
      200: {
        description: 'Success',
      },
    },
  })
  @Authorized([EUserRole.ROLE_USER])
  @HttpCode(200)
  @Post('/:nonce/connect')
  public async timeTrackerConnect(
    @CurrentUser() currentUser: User,
    @Param('nonce') nonce: string,
    @Req() req: express.Request,
    @Res() res: express.Response,
  ): Promise<express.Response> {
    await this.authenticatorTimeTracker.timeTrackerConnect(
      nonce,
      currentUser,
      req.ip ?? '',
    )

    res.end()
    return res
  }

  @OpenAPI({
    summary: 'Poll time-tracker auth state by nonce',
    responses: {
      200: {
        content: {
          'application/json': {
            examples: {
              init: {
                value: {
                  nonce: faker.string.uuid(),
                  ip: '127.0.0.1',
                  state: EAuthTimeTrackerState.INIT,
                },
              },
              login: {
                value: {
                  nonce: faker.string.uuid(),
                  ip: '127.0.0.1',
                  state: EAuthTimeTrackerState.LOGIN,
                },
              },
              connected: {
                value: {
                  nonce: faker.string.uuid(),
                  ip: '127.0.0.1',
                  state: EAuthTimeTrackerState.CONNECTED,
                  jwt: {
                    accessToken: 'aaa.bbb.ccc',
                    refreshToken: 'ddd.eee.fff',
                  },
                },
              },
            },
            schema: {
              type: 'object',
              properties: {
                nonce: {
                  type: 'string',
                },
                ip: {
                  type: 'string',
                },
                state: {
                  type: 'string',
                },
                jwt: {
                  type: 'object',
                  properties: {
                    accessToken: { type: 'string' },
                    refreshToken: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @HttpCode(200)
  @Get('/:nonce')
  public async timeTrackerNonceGet(
    @Param('nonce') nonce: string,
    @Req() req: express.Request,
  ): Promise<TimeTrackerNonceCache> {
    return this.authenticatorTimeTracker.timeTrackerNonceGet(
      nonce,
      req.ip ?? '',
    )
  }
}
