import {
  Authorized,
  Body,
  Delete,
  Get,
  HttpCode,
  JsonController,
  Post,
  QueryParam,
  Res,
} from 'routing-controllers'

import { OpenAPIExtended } from '@/decorator/openapi/openapi-extended'
import { App } from '@/app/app'
import { User } from '@/entity/user'
import { EUserRole } from '@/model/user'
import { CurrentUser } from '@/decorator/current-user'
import { TimeManager } from '@/service/time-manager'
import { TimeRepository } from '@/repository/time-repository'
import {
  TimeCreateDto,
  TimeInsertionResultDto,
  TimeSearchDto,
} from '@/model/dto/time'
import { Time } from '@/entity/time'
import { EntityFromParam } from '@/decorator/entity-from-param'
import { ITimeInsertionResult } from '@/model/time'
import { Project } from '@/entity/project'
import express from 'express'

@Authorized([EUserRole.ROLE_USER])
@JsonController('/time')
export class TimeController {
  protected timeManager: TimeManager
  protected timeRepository: TimeRepository

  constructor() {
    this.timeManager = App.container.get('TimeManager')
    this.timeRepository = App.container.get('TimeRepository')
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
    return this.timeRepository.findAndCountPersonal(search, currentUser)
  }

  @OpenAPIExtended({
    summary: 'Aggregated time totals for project owner',
    response: {
      schema: null,
      options: {
        inlineSchema: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      transformGroups: ['search'],
    },
  })
  @Get('/totals')
  public getTotals(
    @CurrentUser() currentUser: User,
    @QueryParam('projectId') projectId?: string,
  ) {
    return this.timeRepository.getTotals(currentUser, projectId)
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
    return await this.timeManager.buildAndCacheReport(project, currentUser)
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
    summary: 'Get one time entry',
    response: {
      schema: Time,
      options: { serializationGroup: 'search' },
    },
  })
  @Get('/:id')
  public read(
    @CurrentUser() currentUser: User,
    @EntityFromParam({ paramName: 'id', relations: { project: true } })
    time: Time,
  ) {
    return this.timeRepository.findOneConfirmUser(time, currentUser)
  }

  @OpenAPIExtended({
    summary: 'Delete time entry',
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
