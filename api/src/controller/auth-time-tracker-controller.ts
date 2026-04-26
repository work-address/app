import {Post, JsonController, HttpCode, Get, Req, Authorized, Param} from 'routing-controllers';

import express from 'express';
import faker from 'faker';
import {OpenAPI} from 'routing-controllers-openapi';

import {CurrentUser} from '../decorator/current-user';
import {User} from '../entity/user';
import {App} from '../app/app';
import {EUserRole} from '../interface/user';
import {AuthenticatorTimeTracker} from '../service/auth/authenticator-time-tracker';
import {EAuthTimeTrackerState} from '../interface/auth';
import {OpenApi} from '../service/open-api';

@JsonController('/auth/timeTracker')
export class AuthTimeTrackerController {
  protected authenticatorTimeTracker: AuthenticatorTimeTracker;

  constructor() {
    this.authenticatorTimeTracker = App.container.get('AuthenticatorTimeTracker');
  }

  @OpenAPI({
    summary: 'Start time-tracker auth: create nonce',
    description:
      'First step for desktop time-tracker flow. Uses client IP from the request. No JSON body required.',
    responses: {
      200: {
        description: 'Nonce payload for the tracker to poll',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['nonce', 'startAt', 'state', 'ip'],
              properties: {
                nonce: {type: 'string'},
                startAt: {type: 'number', description: 'Unix timestamp (ms)'},
                state: {type: 'string'},
                ip: {type: 'string'},
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
    nonce: string;
    startAt: number;
    state: EAuthTimeTrackerState;
    ip: string;
  }> {
    return await this.authenticatorTimeTracker.timeTrackerNonceGenerate(req.ip ?? '');
  }

  @OpenAPI({
    summary: 'Time-tracker: complete login for nonce',
    description: 'Called by the tracker app after website connect flow; identifies session by path `nonce`.',
    parameters: [
      {
        in: 'path',
        name: 'nonce',
        required: true,
        schema: {type: 'string'},
      },
    ],
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
                description: 'Nonce from POST /auth/timeTracker/nonce response',
              },
            },
          },
        },
      },
      required: true,
    },
    responses: {
      200: {
        description: 'Empty object on success',
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
    summary: 'Browser: link logged-in user to time-tracker session',
    description:
      'Authenticated website user connects a tracker session identified by `nonce` (path). Body may repeat nonce for clarity.',
    parameters: [
      OpenApi.bearerAuthParameter,
      {
        in: 'path',
        name: 'nonce',
        required: true,
        schema: {type: 'string'},
      },
    ],
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
        description: 'Empty object on success',
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
    summary: 'Poll time-tracker auth state by nonce',
    description: 'GET with `nonce` in path; optional IP check on server.',
    parameters: [
      {
        in: 'path',
        name: 'nonce',
        required: true,
        schema: {type: 'string'},
      },
    ],
    responses: {
      200: {
        description: 'State for the nonce; includes `jwt` when CONNECTED',
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
                  type: 'object',
                  properties: {
                    accessToken: {type: 'string'},
                    refreshToken: {type: 'string'},
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
