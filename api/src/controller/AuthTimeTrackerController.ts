import {Post, JsonController, HttpCode, Get, Req, Authorized, Param} from 'routing-controllers';

import express from 'express';
import faker from 'faker';
import {OpenAPI} from 'routing-controllers-openapi';

import {CurrentUser} from '../decorator/CurrentUser';
import {User} from '../entity/User';
import {App} from '../app/App';
import {EUserRole} from '../interface/EUserRole';
import {AuthenticatorTimeTracker} from '../service/auth/AuthenticatorTimeTracker';
import {EAuthTimeTrackerState} from '../interface/EAuthTimeTrackerState';

@JsonController('/auth/timeTracker')
export class AuthTimeTrackerController {
  protected authenticatorTimeTracker: AuthenticatorTimeTracker;

  constructor() {
    this.authenticatorTimeTracker = App.container.get('AuthenticatorTimeTracker');
  }

  @OpenAPI({
    summary:
      'Nonce generate operation as first stap of authentication process for the timetracker app',
    requestBody: {
      content: {
        'application/json': {
          example: {},
          schema: {
            properties: {},
          },
        },
      },
      required: false,
    },
  })
  @HttpCode(200)
  @Post('/nonce')
  public async timeTrackerNonceGenerate(@Req() req: express.Request): Promise<{
    nonce: string;
    startAt: number;
    state: EAuthTimeTrackerState;
    ip: string;
  }> {
    return await this.authenticatorTimeTracker.timeTrackerNonceGenerate(req.ip ?? '');
  }

  @OpenAPI({
    summary: 'Login operation by the timetracker app to be after connected via website',
    requestBody: {
      content: {
        'application/json': {
          example: {
            nonce: faker.datatype.uuid(),
          },
          schema: {
            properties: {
              nonce: {
                type: 'string',
                description: 'Nonce initially retrieved from none generate endpoint',
              },
            },
          },
        },
      },
      required: true,
    },
    responses: {
      200: {
        description: 'On sucess replies with the empty object',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {},
            },
          },
        },
      },
    },
  })
  @HttpCode(200)
  @Post('/:nonce/login')
  public async timeTrackerLogin(
    @Param('nonce') nonce: string,
    @Req() req: express.Request
  ): Promise<Record<string, never>> {
    await this.authenticatorTimeTracker.timeTrackerLogin(nonce, req.ip ?? '');

    return {};
  }

  @OpenAPI({
    summary: 'Used by the client(website) to authenicate and connects timetracker app',
    requestBody: {
      content: {
        'application/json': {
          example: {
            nonce: faker.datatype.uuid(),
          },
          schema: {
            properties: {
              nonce: {
                type: 'string',
                description: 'Nonce passed from timetracker app via URL param ',
              },
            },
          },
        },
      },
      required: true,
    },
    responses: {
      200: {
        description: 'On sucess replies with the empty object',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {},
            },
          },
        },
      },
    },
  })
  @Authorized([EUserRole.ROLE_USER])
  @HttpCode(200)
  @Post('/:nonce/connect')
  public async timeTrackerConnect(
    @CurrentUser() currentUser: User,
    @Param('nonce') nonce: string,
    @Req() req: express.Request
  ): Promise<Record<string, never>> {
    await this.authenticatorTimeTracker.timeTrackerConnect(nonce, currentUser, req.ip ?? '');

    return {};
  }

  @OpenAPI({
    summary: 'Returns authentication state from nonce',
    requestBody: {
      content: {
        'application/json': {
          example: {
            nonce: faker.datatype.uuid(),
          },
          schema: {
            properties: {
              nonce: {
                type: 'string',
                description: 'Nonce used in the auth process by the timetracker or website',
              },
            },
          },
        },
      },
      required: false,
    },
    responses: {
      200: {
        description: 'On sucess replies with the state for the nonce provided',
        content: {
          'application/json': {
            examples: {
              init: {
                value: {
                  nonce: faker.datatype.uuid(),
                  ip: '127.0.0.1',
                  state: EAuthTimeTrackerState.INIT,
                },
              },
              login: {
                value: {
                  nonce: faker.datatype.uuid(),
                  ip: '127.0.0.1',
                  state: EAuthTimeTrackerState.LOGIN,
                },
              },
              connected: {
                value: {
                  nonce: faker.datatype.uuid(),
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
                  description: 'Nonce used in the auth process by the timetracker or website',
                },
                ip: {
                  type: 'string',
                  description: 'IP address of a user provided the timetracker app or website',
                },
                state: {
                  type: 'string',
                  description: 'Authentication state',
                },
                jwt: {
                  type: {
                    accessToken: 'string',
                    refreshToken: 'string',
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
    @Req() req: express.Request
  ): Promise<Record<string, never>> {
    return this.authenticatorTimeTracker.timeTrackerNonceGet(nonce, req.ip ?? '');
  }
}
