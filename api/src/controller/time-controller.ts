import {
  Authorized,
  Body,
  Delete,
  Get,
  HttpCode,
  JsonController,
  Post,
  Put,
  Res,
} from 'routing-controllers'

import { OpenAPIExtended } from '@/decorator/openapi/openapi-extended'
import { App } from '@/app/app'
import { User } from '@/entity/user'
import { EUserRole } from '@/model/user'
import { CurrentUser } from '@/decorator/current-user'
import { TimeManager } from '@/service/time-manager'
import { TimeRepository } from '@/repository/time-repository'
import { ProjectRepository } from '@/repository/project-repository'
import {
  TimeCreateDto,
  TimeIdsDto,
  TimeInsertionResultDto,
  TimeSearchDto,
} from '@/model/dto/time'
import { Time } from '@/entity/time'
import { EntityFromParam } from '@/decorator/entity-from-param'
import { ITimeInsertionResult } from '@/model/time'
import { Project } from '@/entity/project'
import AccessException from '@/exception/access-exception'
import express from 'express'

@Authorized([EUserRole.ROLE_USER])
@JsonController('/time')
export class TimeController {
  protected timeManager: TimeManager
  protected timeRepository: TimeRepository
  protected projectRepository: ProjectRepository

  constructor() {
    this.timeManager = App.container.get('TimeManager')
    this.timeRepository = App.container.get('TimeRepository')
    this.projectRepository = App.container.get('ProjectRepository')
  }

  @OpenAPIExtended({
    summary: 'Search time entries',
    searchRequestBody: {
      example: {
        filter: {
          projectId: 'dd8a088d-00c1-499f-a75b-7ca45821a7e3',
          fromAt: 1700000000000,
          toAt: 1700086400000,
        },
        sort: { createdAt: 'ASC' },
        page: 0,
      },
    },
    response: {
      schema: Time,
      options: { isPagination: true, serializationGroup: 'search' },
    },
  })
  @Post('/search')
  public search(
    @Body() search: TimeSearchDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.timeRepository.findAndCount(search, currentUser)
  }

  @OpenAPIExtended({
    summary: 'Mark time entries as paid',
    body: {
      schema: TimeIdsDto,
      options: {
        example: {
          ids: ['dd8a088d-00c1-499f-a75b-7ca45821a7e3'],
        },
      },
    },
    response: {
      schema: {},
      options: { emptyBody: true },
    },
  })
  @Post('/paid')
  @HttpCode(200)
  public async markPaid(
    @CurrentUser() currentUser: User,
    @Body() body: TimeIdsDto,
    @Res() res: express.Response,
  ): Promise<express.Response> {
    await this.timeManager.setIsPaidMany(body.ids, true, currentUser)

    res.end()
    return res
  }

  @OpenAPIExtended({
    summary: 'Mark time entries as unpaid',
    body: {
      schema: TimeIdsDto,
      options: {
        example: {
          ids: ['dd8a088d-00c1-499f-a75b-7ca45821a7e3'],
        },
      },
    },
    response: {
      schema: {},
      options: { emptyBody: true },
    },
  })
  @Post('/unpaid')
  @HttpCode(200)
  public async markUnpaid(
    @CurrentUser() currentUser: User,
    @Body() body: TimeIdsDto,
    @Res() res: express.Response,
  ): Promise<express.Response> {
    await this.timeManager.setIsPaidMany(body.ids, false, currentUser)

    res.end()
    return res
  }

  @OpenAPIExtended({
    summary: 'Aggregated time totals for project owner, workers, and viewers',
    response: {
      schema: null,
      options: {
        inlineSchema: {
          type: 'array',
          items: { type: 'object' },
        },
      },
    },
  })
  @Get('/totals/:id/project')
  public async getTotals(
    @CurrentUser() currentUser: User,
    @EntityFromParam({ paramName: 'id' }) project: Project,
  ) {
    const accessible = await this.projectRepository.findProjectWithAccess(
      project,
      currentUser,
    )

    if (!accessible) {
      throw new AccessException()
    }

    return this.timeRepository.getTotals(currentUser, project.id)
  }

  @OpenAPIExtended({
    summary: 'Cached time report for a project',
    response: {
      schema: null,
      options: { inlineSchema: { type: 'object' } },
      transformGroups: ['search'],
    },
  })
  @Get('/report/:id')
  public async getReport(
    @CurrentUser() currentUser: User,
    @EntityFromParam({ paramName: 'id' }) project: Project,
  ) {
    const accessible = await this.projectRepository.findProjectWithAccess(
      project,
      currentUser,
    )

    if (!accessible) {
      throw new AccessException()
    }

    return await this.timeManager.buildAndCacheReport(accessible, currentUser)
  }

  @OpenAPIExtended({
    summary: 'Create or update many time rows (batch)',
    body: {
      schema: TimeCreateDto,
      options: {
        isArray: true,
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
    response: {
      schema: TimeInsertionResultDto,
      options: { isArray: true },
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
      transform: { groups: ['create'] },
    })
    data: TimeCreateDto[],
  ): Promise<ITimeInsertionResult[]> {
    return this.timeManager.createOrUpdateMany(data, currentUser)
  }

  @OpenAPIExtended({
    summary: 'Update time entry (tracking worker only)',
    body: {
      schema: Time,
      options: { serializationGroup: 'edit' },
    },
    response: {
      schema: {},
      options: { emptyBody: true },
    },
  })
  @Put('/:id')
  @HttpCode(200)
  public async edit(
    @CurrentUser() currentUser: User,
    @EntityFromParam({
      paramName: 'id',
      relations: { project: { user: true }, user: true },
    })
    time: Time,
    @Body({ validate: { groups: ['edit'] }, transform: { groups: ['edit'] } })
    data: Time,
    @Res() res: express.Response,
  ): Promise<express.Response> {
    if (!time.isAuthor(currentUser)) {
      throw new AccessException()
    }

    await this.timeManager.editAndSave(time, data)

    res.end()
    return res
  }

  @OpenAPIExtended({
    summary: 'Remove screenshot from time entry (tracking worker only)',
    response: {
      schema: {},
      options: { emptyBody: true },
    },
  })
  @Delete('/:id/screenshot')
  @HttpCode(200)
  public async removeScreenshot(
    @CurrentUser() currentUser: User,
    @EntityFromParam({
      paramName: 'id',
      relations: { project: { user: true }, user: true },
    })
    time: Time,
    @Res() res: express.Response,
  ): Promise<express.Response> {
    if (!time.isAuthor(currentUser)) {
      throw new AccessException()
    }

    await this.timeManager.removeScreenshot(time)

    res.end()
    return res
  }

  @OpenAPIExtended({
    summary: 'Remove processes from time entry (tracking worker only)',
    response: {
      schema: {},
      options: { emptyBody: true },
    },
  })
  @Delete('/:id/processes')
  @HttpCode(200)
  public async removeProcesses(
    @CurrentUser() currentUser: User,
    @EntityFromParam({
      paramName: 'id',
      relations: { project: { user: true }, user: true },
    })
    time: Time,
    @Res() res: express.Response,
  ): Promise<express.Response> {
    if (!time.isAuthor(currentUser)) {
      throw new AccessException()
    }

    await this.timeManager.removeProcesses(time)

    res.end()
    return res
  }

  @OpenAPIExtended({
    summary: 'Get one time entry',
    response: {
      schema: Time,
      options: { serializationGroup: 'search' },
    },
  })
  @Get('/:id')
  public read(
    @CurrentUser() currentUser: User,
    @EntityFromParam({
      paramName: 'id',
      relations: { project: { user: true } },
    })
    time: Time,
  ) {
    return this.timeRepository.findOneConfirmUser(time, currentUser)
  }

  @OpenAPIExtended({
    summary: 'Delete time entry (tracking worker only)',
    response: {
      schema: {},
      options: { emptyBody: true },
    },
  })
  @Delete('/:id')
  @HttpCode(200)
  public async delete(
    @CurrentUser() currentUser: User,
    @EntityFromParam({ paramName: 'id' }) time: Time,
    @Res() res: express.Response,
  ): Promise<express.Response> {
    await this.timeManager.remove(time, currentUser)

    res.end()
    return res
  }
}
