import {
  Authorized,
  Body,
  Get,
  HttpCode,
  JsonController,
  Param,
  Post,
  Put,
  ResponseClassTransformOptions,
} from 'routing-controllers'
import faker from 'faker'
import { OpenAPI } from 'routing-controllers-openapi'

import { App } from '@/app/app'
import { User } from '@/entity/user'
import { EUserRole } from '@/interface/user'
import { UserManager } from '@/service/user-manager'
import { AbstractController } from '@/controller/abstract-controller'
import { CurrentUser } from '@/decorator/current-user'
import { UserRepository } from '@/repository/user-repository'
import { ISearchUser } from '@/interface/search'
import { ExtendedResponseSchema } from '@/decorator/extended-response-schema'
import { OpenApi } from '@/service/open-api'

@JsonController('/user')
export class UserController extends AbstractController {
  protected userManager: UserManager
  protected userRepository: UserRepository

  constructor() {
    super()

    this.userManager = App.container.get('UserManager')
    this.userRepository = App.container.get('UserRepository')
  }

  @OpenAPI({
    summary: 'Search users',
    description: '`filter` may include `id`, `role` (see ISearchUser).',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: OpenApi.searchRequestBodySchema,
          example: {
            filter: {},
            sort: { createdAt: 'ASC' },
            page: 0,
          },
        },
      },
    },
    responses: {
      200: OpenApi.paginatedTupleResponse,
    },
  })
  @Post('/search')
  @ResponseClassTransformOptions({ groups: ['search'] })
  public search(@Body() search: ISearchUser) {
    return this.userRepository.findAndCount(search)
  }

  @OpenAPI({
    summary: 'Public profile by wallet address',
    parameters: [
      {
        in: 'path',
        name: 'address',
        required: true,
        schema: { type: 'string' },
        description: 'On-chain address string as stored on the user',
      },
    ],
    responses: {
      200: {
        description: 'User (search group)',
        content: {
          'application/json': { schema: { type: 'object' } },
        },
      },
    },
  })
  @Get('/:address/address')
  @ExtendedResponseSchema(User)
  @ResponseClassTransformOptions({ groups: ['search'] })
  public read(@Param('address') address: string): Promise<User> {
    return this.userRepository.findByAddressPublicOrFail(address)
  }

  @Put()
  @HttpCode(204)
  @OpenAPI({
    summary: 'Update current user profile',
    description: 'Validates body against User `edit` groups (partial updates).',
    parameters: [OpenApi.bearerAuthParameter],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          example: {
            bio: 'Full-stack developer',
            tz: 'America/Los_Angeles',
            phone: faker.phone.phoneNumber(),
          },
          schema: {
            type: 'object',
            description: 'Subset of User editable fields',
            properties: {
              bio: { type: 'string' },
              tz: { type: 'string' },
              phone: { type: 'string' },
              email: { type: 'string' },
              region: { type: 'string' },
              country: { type: 'string' },
            },
          },
        },
      },
    },
    responses: {
      204: {
        description: 'No content',
      },
    },
  })
  @Authorized([EUserRole.ROLE_USER])
  public async edit(
    @CurrentUser() currentUser: User,
    @Body({ validate: { groups: ['edit'] }, transform: { groups: ['edit'] } })
    data: User,
  ) {
    await this.userManager.editValidateAndSave(currentUser, data)
    return {}
  }
}
