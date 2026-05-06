import {
  Post,
  JsonController,
  Res,
  HttpCode,
  Get,
  Body,
  Req,
} from 'routing-controllers'
import express from 'express'

import {
  OpenAPIExtended,
  OpenAPIExtendedResponsePart,
} from '@/decorator/openapi/openapi-extended'
import {
  AuthEthLoginDto,
  AuthNonceRequestDto,
  AuthRefreshTokenDto,
  AuthTonLoginDto,
} from '@/model/dto/auth'
import { User } from '@/entity/user'
import { App } from '@/app/app'
import { Authenticator } from '@/service/auth/authenticator'
import { UserManager } from '@/service/user-manager'
import { UserRepository } from '@/repository/user-repository'
import { IConfigParameters } from '@/model/config'

const authSessionJsonHeadersResponse: OpenAPIExtendedResponsePart<
  Record<string, never>
> = {
  schema: {},
  options: {
    emptyBody: true,
    headers: {
      Authorization: {
        required: true,
        schema: { type: 'string' as const },
      },
      'Refresh-Token': {
        required: true,
        schema: { type: 'string' as const },
      },
    },
  },
}

// TODO: support login with solana blockchain
@JsonController('/auth')
export class AuthController {
  protected authenticator: Authenticator
  protected userManager: UserManager
  protected userRepository: UserRepository
  protected parameters: IConfigParameters

  constructor() {
    this.userManager = App.container.get('UserManager')
    this.userRepository = App.container.get('UserRepository')
    this.authenticator = App.container.get('Authenticator')
    this.parameters = App.container.get('parameters')
  }

  @OpenAPIExtended({
    summary: 'Login with Ethereum wallet',
    body: { schema: AuthEthLoginDto },
    response: authSessionJsonHeadersResponse,
  })
  @Post('/eth')
  @HttpCode(200)
  public async loginEth(
    @Body() payload: AuthEthLoginDto,
    @Res() res: express.Response,
  ): Promise<express.Response> {
    const tokens = await this.authenticator.loginEth(
      payload.signature,
      payload.address,
    )

    res.setHeader('Authorization', tokens.accessToken)
    res.setHeader('Refresh-Token', tokens.refreshToken)

    res.end()
    return res
  }

  @OpenAPIExtended({
    summary: 'Login with TON Connect proof',
    body: { schema: AuthTonLoginDto },
    response: authSessionJsonHeadersResponse,
  })
  @HttpCode(200)
  @Post('/ton')
  public async checkProofHandler(
    @Body() payload: AuthTonLoginDto,
    @Res() res: express.Response,
  ): Promise<express.Response> {
    console.log(payload)

    const tokens = await this.authenticator.loginTon(payload)

    res.setHeader('Authorization', tokens.accessToken)
    res.setHeader('Refresh-Token', tokens.refreshToken)

    res.end()
    return res
  }

  @OpenAPIExtended({
    summary: 'Request nonce for Ethereum login',
    body: { schema: AuthNonceRequestDto },
    response: {
      schema: String,
      options: {},
      example: '550e8400-e29b-41d4-a716-446655440000',
    },
  })
  @HttpCode(200)
  @Post('/nonce')
  public nonce(@Body() payload: AuthNonceRequestDto): Promise<string> {
    return this.authenticator.getNonce(payload.address)
  }

  @OpenAPIExtended({
    summary: 'JWT token rotation',
    operation: {
      parameters: [
        {
          in: 'header',
          name: 'Authorization',
          schema: { type: 'string' },
          required: true,
        },
      ],
    },
    body: { schema: AuthRefreshTokenDto },
    response: authSessionJsonHeadersResponse,
  })
  @Post('/refresh')
  public async refresh(
    @Body() body: AuthRefreshTokenDto,
    @Res() res: express.Response,
  ): Promise<express.Response> {
    const user = await this.authenticator.getUserFromRefreshToken(
      body.refreshToken,
    )
    const tokens = this.authenticator.getTokens(user)

    res.setHeader('Authorization', tokens.accessToken)
    res.setHeader('Refresh-Token', tokens.refreshToken)

    res.end()
    return res
  }

  @OpenAPIExtended({
    summary: 'Current user from JWT',
    optionalAuthorizationHeader: true,
    response: { schema: User, transformGroups: ['search', 'me'] },
  })
  @Get('/status')
  public async status(@Req() req: express.Request): Promise<User | null> {
    const token = req.headers.authorization as string
    const user = await this.authenticator.getUserFromJwtToken(token)

    return user
  }
}
