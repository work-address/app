import {
  Authorized,
  Body,
  Delete,
  Get,
  HttpCode,
  JsonController,
  Post,
  Put,
  Res,
} from 'routing-controllers'
import { OpenAPIExtended } from '@/decorator/openapi/openapi-extended'
import { App } from '@/app/app'
import { User } from '@/entity/user'
import { EUserRole } from '@/model/user'
import { UserManager } from '@/service/user-manager'
import { CurrentUser } from '@/decorator/current-user'
import { UserRepository } from '@/repository/user-repository'
import { EntityFromParam } from '@/decorator/entity-from-param'
import express from 'express'
import { runPromise } from '@/service/effect-bridge'
import { UserSettingsManager } from '@/service/user-settings-manager'
import { UserSettingsDto } from '@/model/dto/user-settings'
import {
  ConnectedWalletConfirmDto,
  ConnectedWalletNonceDto,
} from '@/model/dto/connected-wallet'
import { ConnectedWallet } from '@/service/connected-wallet'

@JsonController('/user')
export class UserController {
  protected userManager: UserManager
  protected userRepository: UserRepository

  constructor() {
    this.userManager = App.container.get('UserManager')
    this.userRepository = App.container.get('UserRepository')
  }

  @Get('/settings')
  @Authorized([EUserRole.ROLE_USER])
  @OpenAPIExtended({
    summary: 'Read private recording settings',
    response: { schema: UserSettingsDto },
  })
  settings(@CurrentUser() user: User) {
    return App.container
      .get<UserSettingsManager>('UserSettingsManager')
      .read(user)
  }

  @Put('/settings')
  @Authorized([EUserRole.ROLE_USER])
  @OpenAPIExtended({
    summary: 'Save private recording settings',
    body: { schema: UserSettingsDto },
    response: { schema: UserSettingsDto },
  })
  saveSettings(@CurrentUser() user: User, @Body() settings: UserSettingsDto) {
    return App.container
      .get<UserSettingsManager>('UserSettingsManager')
      .save(user, settings)
  }

  @OpenAPIExtended({
    summary: 'Profile by account id',
    response: {
      schema: User,
      options: { serializationGroup: 'search' },
    },
  })
  @Get('/:id')
  @Authorized([EUserRole.ROLE_USER])
  public async read(
    @EntityFromParam({ paramName: 'id' })
    user: User,
  ): Promise<User> {
    return user
  }

  @OpenAPIExtended({
    summary: 'Start connecting a wallet: the message it has to sign',
    body: { schema: ConnectedWalletNonceDto },
    response: { schema: String, options: {} },
  })
  @Post('/connected-wallet/nonce')
  @HttpCode(200)
  @Authorized([EUserRole.ROLE_USER])
  connectedWalletNonce(
    @CurrentUser() user: User,
    @Body() payload: ConnectedWalletNonceDto,
  ): Promise<string> {
    return runPromise(
      App.container
        .get<ConnectedWallet>('ConnectedWallet')
        .message(user, payload.address),
    )
  }

  @OpenAPIExtended({
    summary: 'Finish connecting a wallet with its signature',
    body: { schema: ConnectedWalletConfirmDto },
    response: {
      schema: {},
      options: { emptyBody: true, statusCode: 204 },
    },
  })
  @Post('/connected-wallet')
  @HttpCode(204)
  @Authorized([EUserRole.ROLE_USER])
  public async connectWallet(
    @CurrentUser() user: User,
    @Body() payload: ConnectedWalletConfirmDto,
    @Res() res: express.Response,
  ): Promise<express.Response> {
    await runPromise(
      App.container
        .get<ConnectedWallet>('ConnectedWallet')
        .connect(user, payload.address, payload.signature),
    )

    res.status(204).end()
    return res
  }

  @OpenAPIExtended({
    summary: 'Disconnect the connected wallet',
    response: {
      schema: {},
      options: { emptyBody: true, statusCode: 204 },
    },
  })
  @Delete('/connected-wallet')
  @HttpCode(204)
  @Authorized([EUserRole.ROLE_USER])
  public async disconnectWallet(
    @CurrentUser() user: User,
    @Res() res: express.Response,
  ): Promise<express.Response> {
    await runPromise(
      App.container.get<ConnectedWallet>('ConnectedWallet').disconnect(user),
    )

    res.status(204).end()
    return res
  }

  @OpenAPIExtended({
    summary: 'Update current user profile',
    body: {
      schema: User,
      options: { serializationGroup: 'edit' },
    },
    response: {
      schema: {},
      options: { emptyBody: true, statusCode: 204 },
    },
  })
  @Put()
  @HttpCode(204)
  @Authorized([EUserRole.ROLE_USER])
  public async edit(
    @CurrentUser() currentUser: User,
    @Body({ validate: { groups: ['edit'] }, transform: { groups: ['edit'] } })
    data: User,
    @Res() res: express.Response,
  ): Promise<express.Response> {
    await runPromise(this.userManager.editValidateAndSave(currentUser, data))

    res.status(204).end()
    return res
  }
}
