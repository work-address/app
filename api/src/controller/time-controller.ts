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

import {App} from '../app/app';
import {User} from '../entity/user';
import {ExtendedResponseSchema} from '../decorator/extended-response-schema';
import {EUserRole} from '../interface/user';
import {AbstractController} from './abstract-controller';
import {CurrentUser} from '../decorator/current-user';
import {TimeManager} from '../service/time-manager';
import {TimeRepository} from '../repository/time-repository';
import {TimeSearchDto} from '../validator/dto/time-search-dto';
import {Time} from '../entity/time';
import {EntityFromParam} from '../decorator/entity-from-param';
import {ITimeInsertionResult} from '../interface/time';
import {TimeCreateDto} from '../validator/dto/time-create-dto';
import {Project} from '../entity/project';
import {OpenApi} from '../service/open-api';

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
      '`filter` includes `projectId`, `fromAt`, `toAt` (Unix ms) for the current user’s PERSONAL published projects.',
    parameters: [OpenApi.bearerAuthParameter],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: OpenApi.searchRequestBodySchema,
          example: {
            filter: {
              projectId: 'dd8a088d-00c1-499f-a75b-7ca45821a7e3',
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
  public search(@Body() search: TimeSearchDto, @CurrentUser() currentUser: User) {
    return this.timeRepository.findAndCountPersonal(search, currentUser);
  }

  @OpenAPI({
    summary: 'Aggregated time totals for project owner',
    description: 'Optional `projectId` scopes totals to one project.',
    parameters: [
      OpenApi.bearerAuthParameter,
      {
        in: 'query',
        name: 'projectId',
        required: false,
        schema: {type: 'string', format: 'uuid'},
      },
    ],
    responses: {
      200: {
        description: 'Array of per-project aggregate rows',
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
  public getTotals(@CurrentUser() currentUser: User, @QueryParam('projectId') projectId?: string) {
    return this.timeRepository.getTotals(currentUser, projectId);
  }

  @OpenAPI({
    summary: 'Cached time report for a project',
    description: 'User must be allowed to view the project (owner or assigned user).',
    parameters: [
      OpenApi.bearerAuthParameter,
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: {type: 'string', format: 'uuid'},
        description: 'Project id',
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
    @EntityFromParam('id') project: Project
  ) {
    return await this.timeManager.buildAndCacheReport(project, currentUser);
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
                'projectId',
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
                projectId: {type: 'string', format: 'uuid'},
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
              projectId: 'dd8a088d-00c1-499f-a75b-7ca45821a7e3',
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
    description: 'Caller must be project owner or assigned owner for that time row.',
    parameters: [
      OpenApi.bearerAuthParameter,
      {in: 'path', name: 'id', required: true, schema: {type: 'string', format: 'uuid'}},
    ],
    responses: {
      200: {
        description: 'Time with project relation',
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
    @EntityFromParam('id', null, {project: true}) time: Time
  ) {
    return this.timeRepository.findOneConfirmUser(time, currentUser);
  }

  @OpenAPI({
    summary: 'Delete time entry',
    description: 'User must own the time row via assigned project.',
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
