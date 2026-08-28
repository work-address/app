import {
  Authorized,
  Body,
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
import { UserSearchDto } from '@/model/dto/user'
import { EntityFromParam } from '@/decorator/entity-from-param'
import express from 'express'
import { runPromise } from '@/service/effect-bridge'

@JsonController('/user')
export class UserController {
  protected userManager: UserManager
  protected userRepository: UserRepository

  constructor() {
    this.userManager = App.container.get('UserManager')
    this.userRepository = App.container.get('UserRepository')
  }

  @OpenAPIExtended({
    summary: 'Search users',
    searchRequestBody: {
      example: {
        filter: { role: EUserRole.ROLE_USER },
        sort: { createdAt: 'ASC' },
        page: 0,
      },
    },
    response: {
      schema: User,
      options: { isPagination: true, serializationGroup: 'search' },
    },
  })
  @Authorized([EUserRole.ROLE_USER])
  @Post('/search')
  public search(@Body() search: UserSearchDto) {
    return runPromise(this.userRepository.findAndCount(search))
  }

  @OpenAPIExtended({
    summary: 'Public profile by wallet address',
    response: {
      schema: User,
      options: { serializationGroup: 'search' },
    },
  })
  @Get('/:address/address')
  public async read(
    @EntityFromParam({ paramName: 'address', lookupField: 'address' })
    user: User,
  ): Promise<User> {
    return user
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
