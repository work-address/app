import {
  Post,
  BodyParam,
  JsonController,
  Res,
  HttpCode,
  Get,
  Body,
  Req,
  ResponseClassTransformOptions,
} from 'routing-controllers';
import faker from 'faker';

import express from 'express';
import {OpenAPI} from 'routing-controllers-openapi';

import {User} from '../entity/User';
import {App} from '../app/App';
import {Authenticator} from '../service/auth/Authenticator';
import {UserManager} from '../service/UserManager';
import {UserRepository} from '../repository/UserRepository';
import {IConfigParameters} from '../interface/IConfigParameters';
import {ExtendedResponseSchema} from '../decorator/ExtendedResponseSchema';

@JsonController('/auth')
export class AuthController {
  protected authenticator: Authenticator;
  protected userManager: UserManager;
  protected userRepository: UserRepository;
  protected parameters: IConfigParameters;

  constructor() {
    this.userManager = App.container.get('UserManager');
    this.userRepository = App.container.get('UserRepository');
    this.authenticator = App.container.get('Authenticator');
    this.parameters = App.container.get('parameters');
  }

  @OpenAPI({
    summary: 'Auth login Eth',
    requestBody: {
      content: {
        'application/json': {
          examples: {},
        },
      },
      required: false,
    },
    responses: {
      200: {
        description: 'Replies with refresh and login headers sent',
        content: {
          'application/json': {},
        },
        headers: {
          Authorization: {
            required: true,
            schema: {
              type: 'string',
            },
            description: 'contains JWT Access Token',
          },
          'Refresh-Token': {
            required: true,
            schema: {
              type: 'string',
            },
            description: 'contains JWT Refresh Token',
          },
        },
      },
    },
  })
  @Post('/eth')
  @HttpCode(200)
  public async loginEth(
    @Body()
    payload: {
      signature: string;
      address: string;
    },
    @Res() res: any
  ): Promise<Record<string, never>> {
    const tokens = await this.authenticator.loginEth(payload.signature, payload.address);

    res.setHeader('Authorization', tokens.accessToken);
    res.setHeader('Refresh-Token', tokens.refreshToken);

    return {};
  }

  @OpenAPI({
    summary: 'Auth login TON',
    requestBody: {
      content: {
        'application/json': {
          examples: {},
        },
      },
      required: false,
    },
    responses: {
      200: {
        description: 'Replies with refresh and login headers sent',
        content: {
          'application/json': {},
        },
        headers: {
          Authorization: {
            required: true,
            schema: {
              type: 'string',
            },
            description: 'contains JWT Access Token',
          },
          'Refresh-Token': {
            required: true,
            schema: {
              type: 'string',
            },
            description: 'contains JWT Refresh Token',
          },
        },
      },
    },
  })
  @HttpCode(200)
  @Post('/ton')
  public async checkProofHandler(@Body() payload: any, @Res() res: any) {
    console.log(payload);

    const tokens = await this.authenticator.loginTon(payload);

    res.setHeader('Authorization', tokens.accessToken);
    res.setHeader('Refresh-Token', tokens.refreshToken);

    return {};
  }

  @OpenAPI({
    summary: 'Returns nonce for web3 wallet as first step in authentication process',
    requestBody: {
      content: {
        'application/json': {
          examples: {},
        },
      },
      required: false,
    },
    responses: {
      200: {
        description: 'Replies with nonce for user login',
        content: {
          'application/json': {
            example: {
              nonce: faker.datatype.uuid(),
            },
            schema: {
              type: 'object',
              properties: {
                nonce: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    },
  })
  @HttpCode(200)
  @Post('/nonce')
  public nonce(@Body() payload: {address: string}): Promise<string> {
    return this.authenticator.getNonce(payload.address);
  }

  @Post('/refresh')
  @OpenAPI({
    summary: 'JWT token rotation',
    parameters: [
      {
        in: 'header',
        name: 'Authorization',
        schema: {
          type: 'string',
        },
        required: true,
        description: 'Expired Access Token.',
      },
    ],
    requestBody: {
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              refreshToken: {
                type: 'string',
                description: 'Refresh token issued to a user at login.',
              },
            },
          },
        },
      },
      required: true,
    },
    responses: {
      200: {
        description: 'Returns succesfully updated access and refresh tokens in headers',
        content: {
          'application/json': {
            schema: {
              type: 'object',
            },
          },
        },
        headers: {
          Authorization: {
            required: true,
            schema: {
              type: 'string',
            },
            description: 'contains JWT Access Token',
          },
          'Refresh-Token': {
            required: true,
            schema: {
              type: 'string',
            },
            description: 'contains JWT Refresh Token',
          },
        },
      },
    },
  })
  public async refresh(
    @BodyParam('refreshToken') refreshToken: string,
    @Res() res: any
  ): Promise<Record<string, never>> {
    const user = await this.authenticator.getUserFromRefreshToken(refreshToken);
    const tokens = this.authenticator.getTokens(user);

    res.setHeader('Authorization', tokens.accessToken);
    res.setHeader('Refresh-Token', tokens.refreshToken);

    return res.send();
  }

  @OpenAPI({
    summary: 'User authentication status',
  })
  @Get('/status')
  @ExtendedResponseSchema(User)
  @ResponseClassTransformOptions({groups: ['search', 'me']})
  public async status(@Req() req: express.Request): Promise<User | null> {
    const token = req.headers.authorization as string;
    const user = await this.authenticator.getUserFromJwtToken(token);

    return user;
  }
}
