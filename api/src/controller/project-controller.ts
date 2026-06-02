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
import { App } from '@/app/app'
import { User } from '@/entity/user'
import { Project } from '@/entity/project'
import { EntityFromParam } from '@/decorator/entity-from-param'
import { EUserRole } from '@/model/user'
import { CurrentUser } from '@/decorator/current-user'
import { ProjectRepository } from '@/repository/project-repository'
import { ProjectStatistics } from '@/entity/project-statistics'
import { ProjectSearchDto } from '@/model/dto/project'
import { ProjectManager } from '@/service/project-manager'
import { ProjectStatisticsManager } from '@/service/project-statistics-manager'
import { EProjectStatisticsPeriod } from '@/model/project-statistics'
import AccessException from '@/exception/access-exception'

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
    return this.projectRepository.findAndCountAccessibleBy(search, currentUser)
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

    const project = await this.projectManager.createAndSave(data)

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
    return this.projectRepository.findProjectWithAccess(project, currentUser)
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
  public async getStats(
    @CurrentUser() currentUser: User,
    @EntityFromParam({ paramName: 'id' }) project: Project,
    @Param('period') period: EProjectStatisticsPeriod,
  ): Promise<ProjectStatistics[]> {
    const accessible = await this.projectRepository.findProjectWithAccess(
      project,
      currentUser,
    )

    if (!accessible) {
      throw new AccessException()
    }

    return this.projectStatisticsManager.getStatsForProject(accessible, period)
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

    await this.projectManager.editAndSave(project, data)

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

    await this.projectManager.close(project)

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

    await this.projectRepository.softDelete({
      id: project.id,
      user: currentUser,
    })

    res.end()
    return res
  }
}
