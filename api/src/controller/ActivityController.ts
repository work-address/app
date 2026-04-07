import {
  Authorized,
  Body,
  Delete,
  Get,
  HttpCode,
  JsonController,
  Post,
  Put,
  Req,
  Res,
  ResponseClassTransformOptions,
} from 'routing-controllers';
import {OpenAPI} from 'routing-controllers-openapi';
import express from 'express';
import {App} from '../app/App';
import {User} from '../entity/User';
import {Activity} from '../entity/Activity';
import {EntityFromParam} from '../decorator/EntityFromParam';
import {ExtendedResponseSchema} from '../decorator/ExtendedResponseSchema';
import {EUserRole} from '../interface/EUserRole';
import {AbstractController} from './AbstractController';
import {CurrentUser} from '../decorator/CurrentUser';
import {ActivityRepository} from '../repository/ActivityRepository';
import {ActivitySearchDto} from '../validator/dto/ActivitySearchDto';
import {ActivityManager} from '../service/ActivityManager';
import {EActivityType} from '../interface/EActivityType';
import {Proposal} from '../entity/Proposal';
import AccessException from '../exception/AccessException';
import {Authenticator} from '../service/auth/Authenticator';
import {OpenApi} from '../service/OpenApi';

@JsonController('/activity')
export class ActivityController extends AbstractController {
  protected authenticator: Authenticator;
  protected activityManager: ActivityManager;
  protected activityRepository: ActivityRepository;

  constructor() {
    super();

    this.authenticator = App.container.get('Authenticator');
    this.activityManager = App.container.get('ActivityManager');
    this.activityRepository = App.container.get('ActivityRepository');
  }

  @OpenAPI({
    summary: 'Search published activities (public)',
    description:
      'Lists import/hourly/fixed activities in PUBLISHED state. `filter` may include `userId`, `keywords` (array, OR match), etc.',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: OpenApi.searchRequestBodySchema,
          example: {
            filter: {userId: 'uuid-owner', keywords: ['react', 'node']},
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
  @HttpCode(200)
  @Post('/search')
  @ExtendedResponseSchema(Activity, {isPagination: true})
  @ResponseClassTransformOptions({groups: ['search']})
  public search(@Body() search: ActivitySearchDto) {
    return this.activityRepository.findAndCount(search);
  }

  @OpenAPI({
    summary: 'Search activities as freelancer (own personal projects)',
    description:
      'Returns hourly, personal, and fixed activities owned by the current user in PUBLISHED state.',
    parameters: [OpenApi.bearerAuthParameter],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: OpenApi.searchRequestBodySchema,
          example: {
            filter: {},
            sort: {title: 'ASC'},
            page: 0,
          },
        },
      },
    },
    responses: {
      200: OpenApi.paginatedTupleResponse,
    },
  })
  @Post('/search/freelancer')
  @HttpCode(200)
  @Authorized([EUserRole.ROLE_USER])
  @ExtendedResponseSchema(Activity, {isPagination: true})
  @ResponseClassTransformOptions({groups: ['search']})
  public searchFreelancer(@CurrentUser() currentUser: User, @Body() search: ActivitySearchDto) {
    return this.activityRepository.findAndCountFreelancer(search, currentUser);
  }

  @OpenAPI({
    summary: 'Search activities as business (owned by current user)',
    description:
      '`filter` may include `state`, `activityId`, `type` to narrow down owned activities.',
    parameters: [OpenApi.bearerAuthParameter],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: OpenApi.searchRequestBodySchema,
          example: {
            filter: {state: 'DRAFT'},
            sort: {createdAt: 'DESC'},
            page: 0,
          },
        },
      },
    },
    responses: {
      200: OpenApi.paginatedTupleResponse,
    },
  })
  @Post('/search/business')
  @HttpCode(200)
  @Authorized([EUserRole.ROLE_USER])
  @ExtendedResponseSchema(Activity, {isPagination: true})
  @ResponseClassTransformOptions({groups: ['search']})
  public searchBusiness(@CurrentUser() currentUser: User, @Body() search: ActivitySearchDto) {
    return this.activityRepository.findAndCountBusiness(search, currentUser);
  }

  @OpenAPI({
    summary: 'Accept a proposal on an activity',
    description:
      'Business owner only. Binds the proposal as accepted, sets activity to ACTIVE and `startedAt`. Fails if already accepted or activity is not eligible.',
    parameters: [
      OpenApi.bearerAuthParameter,
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: {type: 'string', format: 'uuid'},
        description: 'Activity id',
      },
      {
        in: 'path',
        name: 'proposalId',
        required: true,
        schema: {type: 'string', format: 'uuid'},
        description: 'Proposal id to accept',
      },
    ],
    responses: {
      200: OpenApi.emptyObjectResponse,
    },
  })
  @Post('/:id/accept/:proposalId')
  @HttpCode(200)
  @Authorized([EUserRole.ROLE_USER])
  @ResponseClassTransformOptions({groups: ['search']})
  public async acceptProposal(
    @CurrentUser() currentUser: User,
    @EntityFromParam('id') activity: Activity,
    @EntityFromParam('proposalId') proposal: Proposal
  ) {
    if (currentUser.id !== activity.user.id) {
      throw new AccessException();
    }

    await this.activityManager.acceptProposal(activity, proposal);

    return {};
  }

  @OpenAPI({
    summary: 'Create activity',
    description:
      'Creates HOURLY, FIXED, or PERSONAL activity for the current user. Invalid `type` returns 500 with message.',
    parameters: [OpenApi.bearerAuthParameter],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['title', 'text', 'type', 'state'],
            properties: {
              title: {type: 'string'},
              text: {type: 'string'},
              type: {type: 'string', description: 'HOURLY | FIXED | PERSONAL'},
              state: {type: 'string'},
              trackScreenshots: {type: 'boolean'},
              trackProcesses: {type: 'boolean'},
              location: {type: 'string'},
              position: {type: 'string'},
              employment: {type: 'array', items: {type: 'string'}},
              keywords: {type: 'array', items: {type: 'string'}},
              salary: {type: 'string'},
              rateHour: {type: 'number'},
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Created; `Location` header points to `/api/activity/{id}`',
        headers: {
          Location: {
            schema: {type: 'string'},
            description: 'URI of the new activity',
          },
        },
        content: {
          'application/json': {
            schema: {type: 'object', properties: {}},
          },
        },
      },
    },
  })
  @Post()
  @HttpCode(201)
  @Authorized([EUserRole.ROLE_USER])
  public async create(
    @CurrentUser() currentUser: User,
    @Body({validate: {groups: ['create']}, transform: {groups: ['create']}}) data: Activity,
    @Res() res: any
  ) {
    data.user = currentUser;

    const isValidType = [
      EActivityType.HOURLY,
      EActivityType.FIXED,
      EActivityType.PERSONAL,
    ].includes(data.type);

    if (!isValidType) {
      throw new Error(`The wrong type ${data.type} provided`);
    }

    const activity = await this.activityManager.save(data);

    res.status(201);
    res.location(`/api/activity/${activity.id}`);

    return {};
  }

  @OpenAPI({
    summary: 'Get activity by id',
    description:
      'Visibility depends on caller: guest sees public fields; owner and assigned freelancer see more. Optional `Authorization` for authenticated view.',
    parameters: [
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: {type: 'string', format: 'uuid'},
      },
      {
        in: 'header',
        name: 'Authorization',
        required: false,
        schema: {type: 'string'},
        description: 'Optional JWT for expanded view',
      },
    ],
    responses: {
      200: {
        description: 'Activity (search serialization group)',
        content: {
          'application/json': {
            schema: {type: 'object'},
          },
        },
      },
    },
  })
  @HttpCode(200)
  @Get('/:id')
  @ExtendedResponseSchema(Activity)
  @ResponseClassTransformOptions({groups: ['search']})
  public async read(
    @EntityFromParam('id') activity: Activity,
    @Req() req: express.Request
  ): Promise<Activity | undefined> {
    const token = req.headers['authorization'] as string;
    const user = await this.authenticator.getUserFromJwtToken(token);

    return await this.activityManager.findActivityCheckAccess(activity, user);
  }

  @OpenAPI({
    summary: 'Update activity',
    description: 'Owner only. Active/closed contract activities may be restricted from editing.',
    parameters: [
      OpenApi.bearerAuthParameter,
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: {type: 'string', format: 'uuid'},
      },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {type: 'object', description: 'Fields to update (edit validation group)'},
        },
      },
    },
    responses: {
      200: OpenApi.emptyObjectResponse,
    },
  })
  @Put('/:id')
  @HttpCode(200)
  @Authorized([EUserRole.ROLE_USER])
  public async edit(
    @CurrentUser() currentUser: User,
    @EntityFromParam('id') activity: Activity,
    @Body({validate: {groups: ['edit']}, transform: {groups: ['edit']}}) data: Activity
  ) {
    if (currentUser.id !== activity.user.id) {
      throw new AccessException();
    }

    await this.activityManager.editAndSave(activity, data);

    return {};
  }

  @OpenAPI({
    summary: 'Close activity',
    description: 'Owner only. Sets state CLOSED and `closedAt`.',
    parameters: [
      OpenApi.bearerAuthParameter,
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: {type: 'string', format: 'uuid'},
      },
    ],
    responses: {
      200: OpenApi.emptyObjectResponse,
    },
  })
  @Post('/:id/close')
  @HttpCode(200)
  @Authorized([EUserRole.ROLE_USER])
  @ResponseClassTransformOptions({groups: ['search']})
  public async close(@EntityFromParam('id') activity: Activity, @CurrentUser() currentUser: User) {
    if (currentUser.id !== activity.user.id) {
      throw new AccessException();
    }

    await this.activityManager.close(activity);

    return {};
  }

  @OpenAPI({
    summary: 'Soft-delete activity',
    description: 'Owner only (enforced in repository).',
    parameters: [
      OpenApi.bearerAuthParameter,
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: {type: 'string', format: 'uuid'},
      },
    ],
    responses: {
      200: OpenApi.emptyObjectResponse,
    },
  })
  @Delete('/:id')
  @HttpCode(200)
  public async delete(@CurrentUser() currentUser: User, @EntityFromParam('id') activity: Activity) {
    await this.activityRepository.softDelete({
      id: activity.id,
      user: currentUser,
    });

    return {};
  }
}
