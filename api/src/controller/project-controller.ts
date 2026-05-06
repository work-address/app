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
import { ProjectSearchDto } from '@/model/dto/project'
import { ProjectManager } from '@/service/project-manager'
import AccessException from '@/exception/access-exception'
import { Authenticator } from '@/service/auth/authenticator'

@Authorized([EUserRole.ROLE_USER])
@JsonController('/project')
export class ProjectController {
  protected authenticator: Authenticator
  protected projectManager: ProjectManager
  protected projectRepository: ProjectRepository

  constructor() {
    this.authenticator = App.container.get('Authenticator')
    this.projectManager = App.container.get('ProjectManager')
    this.projectRepository = App.container.get('ProjectRepository')
  }

  @OpenAPIExtended({
    summary: 'Search projects accessible by the current user',
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

    const project = await this.projectManager.save(data)

    res.status(201)
    res.location(`/api/project/${project.id}`)

    res.end()
    return res
  }

  @OpenAPIExtended({
    summary: 'Get project by id',
    optionalAuthorizationHeader: true,
    response: {
      schema: Project,
      options: { serializationGroup: 'search' },
    },
  })
  @Get('/:id')
  @HttpCode(200)
  public async read(
    @EntityFromParam({ paramName: 'id' }) project: Project,
    @Req() req: express.Request,
  ): Promise<Project | undefined> {
    const token = req.headers['authorization'] as string
    const user = await this.authenticator.getUserFromJwtToken(token)

    if (!user) {
      return undefined
    }

    return await this.projectManager.findProjectCheckAccess(project, user)
  }

  @OpenAPIExtended({
    summary: 'Update project',
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
    await this.projectRepository.softDelete({
      id: project.id,
      user: currentUser,
    })

    res.end()
    return res
  }
}
