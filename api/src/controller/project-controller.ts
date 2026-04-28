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
import {App} from '../app/app';
import {User} from '../entity/user';
import {Project} from '../entity/project';
import {EntityFromParam} from '../decorator/entity-from-param';
import {ExtendedResponseSchema} from '../decorator/extended-response-schema';
import {EUserRole} from '../interface/user';
import {AbstractController} from './abstract-controller';
import {CurrentUser} from '../decorator/current-user';
import {ProjectRepository} from '../repository/project-repository';
import {ProjectSearchDto} from '../validator/dto/project-search-dto';
import {ProjectManager} from '../service/project-manager';
import AccessException from '../exception/access-exception';
import {Authenticator} from '../service/auth/authenticator';
import {OpenApi} from '../service/open-api';

@JsonController('/project')
export class ProjectController extends AbstractController {
  protected authenticator: Authenticator;
  protected projectManager: ProjectManager;
  protected projectRepository: ProjectRepository;

  constructor() {
    super();

    this.authenticator = App.container.get('Authenticator');
    this.projectManager = App.container.get('ProjectManager');
    this.projectRepository = App.container.get('ProjectRepository');
  }

  @OpenAPI({
    summary: 'Search projects owned by the current user',
    description: '`filter` may include `state`, `projectId` to narrow down owned projects.',
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
  @Post('/search')
  @HttpCode(200)
  @Authorized([EUserRole.ROLE_USER])
  @ExtendedResponseSchema(Project, {isPagination: true})
  @ResponseClassTransformOptions({groups: ['search']})
  public search(@CurrentUser() currentUser: User, @Body() search: ProjectSearchDto) {
    return this.projectRepository.findAndCountAccessibleBy(search, currentUser);
  }

  @OpenAPI({
    summary: 'Create project',
    description: 'Creates a project for the current user.',
    parameters: [OpenApi.bearerAuthParameter],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['title', 'text', 'state'],
            properties: {
              title: {type: 'string'},
              text: {type: 'string'},
              state: {type: 'string'},
              trackScreenshots: {type: 'boolean'},
              trackProcesses: {type: 'boolean'},
              rateHour: {type: 'number'},
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Created; `Location` header points to `/api/project/{id}`',
        headers: {
          Location: {
            schema: {type: 'string'},
            description: 'URI of the new project',
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
    @Body({validate: {groups: ['create']}, transform: {groups: ['create']}}) data: Project,
    @Res() res: any
  ) {
    data.user = currentUser;

    const project = await this.projectManager.save(data);

    res.status(201);
    res.location(`/api/project/${project.id}`);

    return {};
  }

  @OpenAPI({
    summary: 'Get project by id',
    description:
      'Visibility depends on caller: guest sees public fields; owner sees the full owner view. Optional `Authorization` for authenticated view.',
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
        description: 'Project (search serialization group)',
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
  @ExtendedResponseSchema(Project)
  @ResponseClassTransformOptions({groups: ['search']})
  public async read(
    @EntityFromParam('id') project: Project,
    @Req() req: express.Request
  ): Promise<Project | undefined> {
    const token = req.headers['authorization'] as string;
    const user = await this.authenticator.getUserFromJwtToken(token);

    return await this.projectManager.findProjectCheckAccess(project, user);
  }

  @OpenAPI({
    summary: 'Update project',
    description: 'Owner only. Active/closed contract projects may be restricted from editing.',
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
    @EntityFromParam('id') project: Project,
    @Body({validate: {groups: ['edit']}, transform: {groups: ['edit']}}) data: Project
  ) {
    if (currentUser.id !== project.user.id) {
      throw new AccessException();
    }

    await this.projectManager.editAndSave(project, data);

    return {};
  }

  @OpenAPI({
    summary: 'Close project',
    description: 'Owner only. Sets state to inactive.',
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
  public async close(@EntityFromParam('id') project: Project, @CurrentUser() currentUser: User) {
    if (currentUser.id !== project.user.id) {
      throw new AccessException();
    }

    await this.projectManager.close(project);

    return {};
  }

  @OpenAPI({
    summary: 'Soft-delete project',
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
  public async delete(@CurrentUser() currentUser: User, @EntityFromParam('id') project: Project) {
    await this.projectRepository.softDelete({
      id: project.id,
      user: currentUser,
    });

    return {};
  }
}
