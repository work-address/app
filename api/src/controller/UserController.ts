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
    summary: 'User search',
    requestBody: {
      content: {
        'application/json': {
          example: {
            filter: {},
            sort: {createdAt: 'ASC'},
            page: 0,
          },
          schema: {
            properties: {},
          },
        },
      },
      required: false,
    },
    responses: {
      200: {
        description: 'Empty results',
        content: {
          'application/json': [[], 0.0],
        },
      },
    },
  })
  @Post('/search')
  @ResponseClassTransformOptions({groups: ['search']})
  public search(@Body() search: ISearchUser) {
    return this.userRepository.findAndCount(search);
  }

  @OpenAPI({
    summary: 'User profile by address',
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
    summary: 'User profile edit',
    requestBody: {
      content: {
        'application/json': {
          example: {
            bio: faker.datatype.number(),
            tz: 'America/Los_Angeles',
            phone: faker.phone.phoneNumber(),
          },
          schema: {
            properties: {
              bio: {
                type: 'number',
              },
              phone: {
                type: 'number',
              },
            },
          },
        },
      },
      required: false,
    },
    responses: {
      204: {
        description: 'User profile',
        content: {
          'application/json': {},
        },
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
