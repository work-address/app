import {
  Authorized,
  Body,
  Delete,
  Get,
  HttpCode,
  JsonController,
  Post,
  QueryParam,
  ResponseClassTransformOptions,
} from 'routing-controllers';
import {OpenAPI} from 'routing-controllers-openapi';

import {App} from '../app/App';
import {User} from '../entity/User';
import {ExtendedResponseSchema} from '../decorator/ExtendedResponseSchema';
import {EUserRole} from '../interface/EUserRole';
import {AbstractController} from './AbstractController';
import {CurrentUser} from '../decorator/CurrentUser';
import {TimeManager} from '../service/TimeManager';
import {TimeRepository} from '../repository/TimeRepository';
import {TimeSearchDto} from '../validator/dto/TimeSearchDto';
import {Time} from '../entity/Time';
import {EntityFromParam} from '../decorator/EntityFromParam';
import {ITimeInsertionResult} from '../interface/ITimeInsertionResult';
import {TimeCreateDto} from '../validator/dto/TimeCreateDto';
import {Activity} from '../entity/Activity';
import {OpenApi} from '../service/OpenApi';

@Authorized([EUserRole.ROLE_USER])
@JsonController('/time')
export class TimeController extends AbstractController {
  protected timeManager: TimeManager;
  protected timeRepository: TimeRepository;

  constructor() {
    super();

    this.timeManager = App.container.get('TimeManager');
    this.timeRepository = App.container.get('TimeRepository');
  }

  @OpenAPI({
    summary: 'Search personal time entries',
    description:
      '`filter` includes `activityId`, `fromAt`, `toAt` (Unix ms) for the current user’s PERSONAL published activities.',
    parameters: [OpenApi.bearerAuthParameter],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: OpenApi.searchRequestBodySchema,
          example: {
            filter: {
              activityId: 'dd8a088d-00c1-499f-a75b-7ca45821a7e3',
              fromAt: 1700000000000,
              toAt: 1700086400000,
            },
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
  @ExtendedResponseSchema(Time, {isPagination: true})
  @ResponseClassTransformOptions({groups: ['search']})
  public searchFreelancer(@Body() search: TimeSearchDto, @CurrentUser() currentUser: User) {
    return this.timeRepository.findAndCountPersonal(search, currentUser);
  }

  @OpenAPI({
    summary: 'Aggregated time totals for business user',
    description: 'Optional `activityId` scopes totals to one activity.',
    parameters: [
      OpenApi.bearerAuthParameter,
      {
        in: 'query',
        name: 'activityId',
        required: false,
        schema: {type: 'string', format: 'uuid'},
      },
    ],
    responses: {
      200: {
        description: 'Array of per-activity aggregate rows',
        content: {
          'application/json': {
            schema: {type: 'array', items: {type: 'object'}},
          },
        },
      },
    },
  })
  @Get('/totals')
  @ResponseClassTransformOptions({groups: ['search']})
  public getTotals(
    @CurrentUser() currentUser: User,
    @QueryParam('activityId') activityId?: string
  ) {
    return this.timeRepository.getTotals(currentUser, activityId);
  }

  @OpenAPI({
    summary: 'Cached time report for an activity',
    description: 'User must be allowed to view the activity (owner or assigned freelancer).',
    parameters: [
      OpenApi.bearerAuthParameter,
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: {type: 'string', format: 'uuid'},
        description: 'Activity id',
      },
    ],
    responses: {
      200: {
        description: 'Report payload (see TimeManager.buildAndCacheReport)',
        content: {
          'application/json': {schema: {type: 'object'}},
        },
      },
    },
  })
  @Get('/report/:id')
  @ResponseClassTransformOptions({groups: ['search']})
  public async getReport(
    @CurrentUser() currentUser: User,
    @EntityFromParam('id') activity: Activity
  ) {
    return await this.timeManager.buildAndCacheReport(activity, currentUser);
  }

  @OpenAPI({
    summary: 'Create or update many time rows (batch)',
    description:
      'Each item is processed independently; failures include an `error` object instead of `id`. Optional `screenshot` and `processes` per row.',
    parameters: [OpenApi.bearerAuthParameter],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              type: 'object',
              required: [
                'fromIndex',
                'toIndex',
                'note',
                'keyboardKeys',
                'minutesActive',
                'mouseKeys',
                'mouseDistance',
                'fromAt',
                'toAt',
                'activityId',
              ],
              properties: {
                fromIndex: {type: 'number'},
                toIndex: {type: 'number'},
                note: {type: 'string'},
                keyboardKeys: {type: 'number'},
                minutesActive: {type: 'number'},
                mouseKeys: {type: 'number'},
                mouseDistance: {type: 'number'},
                fromAt: {type: 'string', format: 'date-time'},
                toAt: {type: 'string', format: 'date-time'},
                activityId: {type: 'string', format: 'uuid'},
                screenshot: {type: 'string', description: 'Base64 or data URL'},
                processes: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: {type: 'string'},
                      description: {type: 'string'},
                      timeMin: {type: 'number'},
                    },
                  },
                },
              },
            },
          },
          example: [
            {
              fromIndex: 1000,
              toIndex: 2000,
              note: 'Focus block',
              keyboardKeys: 3,
              minutesActive: 4,
              mouseKeys: 3,
              mouseDistance: 5,
              fromAt: '2024-01-21T09:00:00.000Z',
              toAt: '2024-01-21T09:10:00.000Z',
              activityId: 'dd8a088d-00c1-499f-a75b-7ca45821a7e3',
            },
          ],
        },
      },
    },
    responses: {
      200: {
        description:
          'Array parallel to input: each element echoes the row with `id` on success, or `error` (e.g. validation / DB) on failure',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {type: 'string', format: 'uuid'},
                  error: {
                    type: 'object',
                    properties: {
                      name: {type: 'string'},
                      message: {type: 'string'},
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @Post()
  @HttpCode(200)
  public createOrUpdateMany(
    @CurrentUser() currentUser: User,
    @Body({
      validate: {
        groups: ['create'],
      },
      transform: {groups: ['create']},
    })
    data: TimeCreateDto[]
  ): Promise<ITimeInsertionResult[]> {
    return this.timeManager.createOrUpdateMany(data, currentUser);
  }

  @OpenAPI({
    summary: 'Get one time entry',
    description: 'Caller must be activity owner or assigned freelancer for that time row.',
    parameters: [
      OpenApi.bearerAuthParameter,
      {in: 'path', name: 'id', required: true, schema: {type: 'string', format: 'uuid'}},
    ],
    responses: {
      200: {
        description: 'Time with activity relation',
        content: {
          'application/json': {schema: {type: 'object'}},
        },
      },
    },
  })
  @Get('/:id')
  @ExtendedResponseSchema(Time)
  @ResponseClassTransformOptions({groups: ['search']})
  public read(
    @CurrentUser() currentUser: User,
    @EntityFromParam('id', null, {activity: true}) time: Time
  ) {
    return this.timeRepository.findOneConfirmUser(time, currentUser);
  }

  @OpenAPI({
    summary: 'Delete time entry',
    description: 'Freelancer must own the time row via assigned activity.',
    parameters: [
      OpenApi.bearerAuthParameter,
      {in: 'path', name: 'id', required: true, schema: {type: 'string', format: 'uuid'}},
    ],
    responses: {
      200: OpenApi.emptyObjectResponse,
    },
  })
  @Delete('/:id')
  @HttpCode(200)
  public async delete(@CurrentUser() currentUser: User, @EntityFromParam('id') time: Time) {
    await this.timeManager.remove(time, currentUser);

    return {};
  }
}
