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
} from 'routing-controllers';
import faker from 'faker';
import {OpenAPI} from 'routing-controllers-openapi';

import {App} from '../app/App';
import {User} from '../entity/User';
import {EUserRole} from '../interface/EUserRole';
import {UserManager} from '../service/UserManager';
import {AbstractController} from './AbstractController';
import {CurrentUser} from '../decorator/CurrentUser';
import {UserRepository} from '../repository/UserRepository';
import {ISearchUser} from '../interface/search/ISearchUser';
import {ExtendedResponseSchema} from '../decorator/ExtendedResponseSchema';
import {OpenApi} from '../service/OpenApi';

@JsonController('/user')
export class UserController extends AbstractController {
  protected userManager: UserManager;
  protected userRepository: UserRepository;

  constructor() {
    super();

    this.userManager = App.container.get('UserManager');
    this.userRepository = App.container.get('UserRepository');
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
            sort: {createdAt: 'ASC'},
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
  @ResponseClassTransformOptions({groups: ['search']})
  public search(@Body() search: ISearchUser) {
    return this.userRepository.findAndCount(search);
  }

  @OpenAPI({
    summary: 'Public profile by wallet address',
    parameters: [
      {
        in: 'path',
        name: 'address',
        required: true,
        schema: {type: 'string'},
        description: 'On-chain address string as stored on the user',
      },
    ],
    responses: {
      200: {
        description: 'User (search group)',
        content: {
          'application/json': {schema: {type: 'object'}},
        },
      },
    },
  })
  @Get('/:address/address')
  @ExtendedResponseSchema(User)
  @ResponseClassTransformOptions({groups: ['search']})
  public read(@Param('address') address: string): Promise<User> {
    return this.userRepository.findByAddressPublicOrFail(address);
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
              bio: {type: 'string'},
              tz: {type: 'string'},
              phone: {type: 'string'},
              email: {type: 'string'},
              region: {type: 'string'},
              country: {type: 'string'},
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
    @Body({validate: {groups: ['edit']}, transform: {groups: ['edit']}}) data: User
  ) {
    await this.userManager.editValidateAndSave(currentUser, data);
    return {};
  }
}
