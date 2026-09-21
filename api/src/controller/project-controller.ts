import {
  Authorized,
  Body,
  Delete,
  Get,
  HttpCode,
  JsonController,
  Param,
  Post,
  Put,
  Res,
} from 'routing-controllers'
import { OpenAPIExtended } from '@/decorator/openapi/openapi-extended'
import express from 'express'
import { SchemaObject } from 'openapi3-ts'
import { App } from '@/app/app'
import { User } from '@/entity/user'
import { Project } from '@/entity/project'
import { EntityFromParam } from '@/decorator/entity-from-param'
import { EUserRole } from '@/model/user'
import { CurrentUser } from '@/decorator/current-user'
import { ProjectRepository } from '@/repository/project-repository'
import { ProjectStatistics } from '@/entity/project-statistics'
import {
  ProjectCadenceConsentDto,
  ProjectCadenceDto,
  ProjectSearchDto,
} from '@/model/dto/project'
import { IInvoiceCadenceView } from '@/model/project'
import { ProjectManager } from '@/service/project-manager'
import { ProjectStatisticsManager } from '@/service/project-statistics-manager'
import { EProjectStatisticsPeriod } from '@/model/project-statistics'
import AccessException from '@/exception/access-exception'
import { Effect } from 'effect'
import { runPromise } from '@/service/effect-bridge'

// Module scope, not static fields: decorator arguments are evaluated before
// static initializers run, so a schema held on the class reads as undefined
// from the decorators below it.

/** One stored cadence version (`IInvoiceCadenceVersion`). */
const CADENCE_VERSION_SCHEMA: SchemaObject = {
  type: 'object',
  required: [
    'weekday',
    'timezone',
    'cutoffLocal',
    'effectiveFrom',
    'finalizationDelayHours',
  ],
  properties: {
    weekday: { type: 'integer' },
    timezone: { type: 'string' },
    cutoffLocal: { type: 'string' },
    effectiveFrom: { type: 'string' },
    finalizationDelayHours: { type: 'integer' },
  },
}

/** What every cadence route answers with (`IInvoiceCadenceView`). */
const CADENCE_VIEW_SCHEMA: SchemaObject = {
  type: 'object',
  required: ['versions', 'canEdit'],
  properties: {
    current: { ...CADENCE_VERSION_SCHEMA, nullable: true },
    versions: { type: 'array', items: CADENCE_VERSION_SCHEMA },
    nextCutoff: { type: 'string', nullable: true },
    nextIssueAt: { type: 'string', nullable: true },
    consented: { type: 'boolean', nullable: true },
    canEdit: { type: 'boolean' },
  },
}

@Authorized([EUserRole.ROLE_USER])
@JsonController('/project')
export class ProjectController {
  protected projectManager: ProjectManager
  protected projectRepository: ProjectRepository
  protected projectStatisticsManager: ProjectStatisticsManager

  constructor() {
    this.projectManager = App.container.get('ProjectManager')
    this.projectRepository = App.container.get('ProjectRepository')
    this.projectStatisticsManager = App.container.get(
      'ProjectStatisticsManager',
    )
  }

  @OpenAPIExtended({
    summary:
      'Search projects accessible to the current user as owner, worker, or viewer',
    searchRequestBody: {
      example: {
        filter: { state: 'DRAFT' },
        sort: { createdAt: 'DESC' },
        page: 0,
      },
    },
    response: {
      schema: Project,
      options: { isPagination: true, serializationGroup: 'search' },
    },
  })
  @Post('/search')
  @HttpCode(200)
  public search(
    @CurrentUser() currentUser: User,
    @Body() search: ProjectSearchDto,
  ) {
    return runPromise(
      this.projectRepository.findAndCountAccessibleBy(search, currentUser),
    )
  }

  @OpenAPIExtended({
    summary: 'Create project',
    body: {
      schema: Project,
      options: { serializationGroup: 'create' },
    },
    response: {
      schema: {},
      options: {
        emptyBody: true,
        statusCode: 201,
        headers: {
          Location: {
            schema: { type: 'string' },
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
    @Body({
      validate: { groups: ['create'] },
      transform: { groups: ['create'] },
    })
    data: Project,
    @Res() res: express.Response,
  ): Promise<express.Response> {
    data.user = currentUser

    const project = await runPromise(this.projectManager.createAndSave(data))

    res.status(201)
    res.location(`/api/project/${project.id}`)

    res.end()
    return res
  }

  @OpenAPIExtended({
    summary: 'Get project by id (project owner, workers, and viewers)',
    response: {
      schema: Project,
      options: { serializationGroup: 'search' },
    },
  })
  @Get('/:id')
  @HttpCode(200)
  public async read(
    @EntityFromParam({ paramName: 'id' }) project: Project,
    @CurrentUser() currentUser: User,
  ): Promise<Project | undefined> {
    return runPromise(
      this.projectRepository.findProjectWithAccess(project, currentUser),
    )
  }

  @OpenAPIExtended({
    summary: 'Get project statistics for project owner, workers, and viewers',
    response: {
      schema: ProjectStatistics,
      options: { isArray: true, serializationGroup: 'search' },
    },
  })
  @Get('/:id/stats/:period')
  @HttpCode(200)
  public getStats(
    @CurrentUser() currentUser: User,
    @EntityFromParam({ paramName: 'id' }) project: Project,
    @Param('period') period: EProjectStatisticsPeriod,
  ): Promise<ProjectStatistics[]> {
    return runPromise(
      this.projectRepository
        .findProjectWithAccessOrFail(project, currentUser)
        .pipe(
          Effect.flatMap((accessible) =>
            this.projectStatisticsManager.getStatsForProject(
              accessible,
              period,
            ),
          ),
        ),
    )
  }

  @OpenAPIExtended({
    summary:
      "Read the project's invoicing cadence, the next cutoff, and your own consent",
    response: {
      schema: null,
      options: { inlineSchema: CADENCE_VIEW_SCHEMA },
    },
  })
  @Get('/:id/cadence')
  @HttpCode(200)
  public readCadence(
    @EntityFromParam({ paramName: 'id' }) project: Project,
    @CurrentUser() currentUser: User,
  ): Promise<IInvoiceCadenceView> {
    return runPromise(this.projectManager.readCadence(project, currentUser))
  }

  @OpenAPIExtended({
    summary: 'Add a version to the project invoicing cadence (owner only)',
    body: {
      schema: ProjectCadenceDto,
      options: {
        // Fixed, not the clock, so the exported spec is the same on every
        // export: Mondays at 09:00 Berlin time, from 2024-01-01T00:00Z.
        example: {
          weekday: 1,
          timezone: 'Europe/Berlin',
          cutoffLocal: '09:00',
          effectiveFromUnix: 1704067200000,
          finalizationDelayHours: 24,
        },
      },
    },
    response: {
      schema: null,
      options: { inlineSchema: CADENCE_VIEW_SCHEMA },
    },
  })
  @Put('/:id/cadence')
  @HttpCode(200)
  @Authorized([EUserRole.ROLE_USER])
  public setCadence(
    @CurrentUser() currentUser: User,
    @EntityFromParam({ paramName: 'id' }) project: Project,
    @Body() data: ProjectCadenceDto,
  ): Promise<IInvoiceCadenceView> {
    return runPromise(
      this.projectManager.setCadence(project, currentUser, data),
    )
  }

  @OpenAPIExtended({
    summary: 'Record your own consent to automatic invoice issuance',
    body: {
      schema: ProjectCadenceConsentDto,
      options: { example: { consented: true } },
    },
    response: {
      schema: null,
      options: { inlineSchema: CADENCE_VIEW_SCHEMA },
    },
  })
  @Put('/:id/cadence/consent')
  @HttpCode(200)
  @Authorized([EUserRole.ROLE_USER])
  public setCadenceConsent(
    @CurrentUser() currentUser: User,
    @EntityFromParam({ paramName: 'id' }) project: Project,
    @Body() data: ProjectCadenceConsentDto,
  ): Promise<IInvoiceCadenceView> {
    return runPromise(
      this.projectManager.setCadenceConsent(
        project,
        currentUser,
        data.consented,
      ),
    )
  }

  @OpenAPIExtended({
    summary: 'Update project (including worker and viewer addresses)',
    body: {
      schema: Project,
      options: { serializationGroup: 'edit' },
    },
    response: {
      schema: {},
      options: { emptyBody: true },
    },
  })
  @Put('/:id')
  @HttpCode(200)
  @Authorized([EUserRole.ROLE_USER])
  public async edit(
    @CurrentUser() currentUser: User,
    @EntityFromParam({ paramName: 'id' }) project: Project,
    @Body({ validate: { groups: ['edit'] }, transform: { groups: ['edit'] } })
    data: Project,
    @Res() res: express.Response,
  ): Promise<express.Response> {
    if (currentUser.id !== project.user.id) {
      throw new AccessException()
    }

    await runPromise(this.projectManager.editAndSave(project, data))

    res.end()
    return res
  }

  @OpenAPIExtended({
    summary: 'Close project',
    response: {
      schema: {},
      options: { emptyBody: true },
    },
  })
  @Post('/:id/close')
  @HttpCode(200)
  @Authorized([EUserRole.ROLE_USER])
  public async close(
    @EntityFromParam({ paramName: 'id' }) project: Project,
    @CurrentUser() currentUser: User,
    @Res() res: express.Response,
  ): Promise<express.Response> {
    if (currentUser.id !== project.user.id) {
      throw new AccessException()
    }

    await runPromise(this.projectManager.close(project))

    res.end()
    return res
  }

  @OpenAPIExtended({
    summary: 'Soft-delete project',
    response: {
      schema: {},
      options: { emptyBody: true },
    },
  })
  @Delete('/:id')
  @HttpCode(200)
  @Authorized([EUserRole.ROLE_USER])
  public async delete(
    @CurrentUser() currentUser: User,
    @EntityFromParam({ paramName: 'id' }) project: Project,
    @Res() res: express.Response,
  ): Promise<express.Response> {
    if (currentUser.id !== project.user.id) {
      throw new AccessException()
    }

    await runPromise(
      this.projectRepository.softDelete({
        id: project.id,
        user: currentUser,
      }),
    )

    res.end()
    return res
  }
}
