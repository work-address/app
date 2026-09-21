import {
  Authorized,
  Body,
  Delete,
  Get,
  HttpCode,
  JsonController,
  Post,
  Put,
  QueryParams,
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
  TimeTotalsQueryDto,
} from '@/model/dto/time'
import { Time } from '@/entity/time'
import { EntityFromParam } from '@/decorator/entity-from-param'
import { IRetentionNotice, ITimeInsertionResult } from '@/model/time'
import { RetentionJob } from '@/service/retention-job'
import { Project } from '@/entity/project'
import AccessException from '@/exception/access-exception'
import express from 'express'
import { Effect } from 'effect'
import { runPromise } from '@/service/effect-bridge'

@Authorized([EUserRole.ROLE_USER])
@JsonController('/time')
export class TimeController {
  protected timeManager: TimeManager
  protected timeRepository: TimeRepository
  protected projectRepository: ProjectRepository
  protected retentionJob: RetentionJob

  constructor() {
    this.retentionJob = App.container.get('RetentionJob')
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
    return runPromise(this.timeRepository.findAndCount(search, currentUser))
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
    await runPromise(
      this.timeManager.setIsPaidMany(body.ids, true, currentUser),
    )

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
    await runPromise(
      this.timeManager.setIsPaidMany(body.ids, false, currentUser),
    )

    res.end()
    return res
  }

  @OpenAPIExtended({
    summary: 'Remove screenshots from time entries (tracking worker only)',
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
  @Delete('/screenshots')
  @HttpCode(200)
  public async removeScreenshots(
    @CurrentUser() currentUser: User,
    @Body() body: TimeIdsDto,
    @Res() res: express.Response,
  ): Promise<express.Response> {
    await runPromise(this.timeManager.removeScreenshots(body.ids, currentUser))

    res.end()
    return res
  }

  @OpenAPIExtended({
    summary: 'Remove processes from time entries (tracking worker only)',
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
  @Delete('/processes')
  @HttpCode(200)
  public async removeProcesses(
    @CurrentUser() currentUser: User,
    @Body() body: TimeIdsDto,
    @Res() res: express.Response,
  ): Promise<express.Response> {
    await runPromise(this.timeManager.removeProcesses(body.ids, currentUser))

    res.end()
    return res
  }

  @OpenAPIExtended({
    summary:
      'Aggregated time totals for project owner, workers, and viewers, optionally inside one window (fromAt/toAt, unix seconds) such as a contract week',
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
  public getTotals(
    @CurrentUser() currentUser: User,
    @EntityFromParam({ paramName: 'id' }) project: Project,
    @QueryParams() window: TimeTotalsQueryDto,
  ) {
    return runPromise(
      this.projectRepository
        .findProjectWithAccessOrFail(project, currentUser)
        .pipe(
          Effect.flatMap(() =>
            this.timeManager.getTotals(currentUser, project, {
              fromAt: TimeController.instant(window.fromAt),
              toAt: TimeController.instant(window.toAt),
            }),
          ),
        ),
    )
  }

  /** A unix second as a Date; undefined stays undefined (no boundary). */
  private static instant(seconds?: number): Date | undefined {
    return seconds === undefined ? undefined : new Date(seconds * 1000)
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
    return runPromise(this.timeManager.createOrUpdateMany(data, currentUser))
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

    await runPromise(this.timeManager.editAndSave(time, data))

    res.end()
    return res
  }

  /**
   * Declared before `GET /:id`, which would otherwise take
   * 'retention-notice' for an id.
   */
  @OpenAPIExtended({
    summary:
      "What rotates out of the caller's free history within the notice lead time, and when the first of it can go (count 0 and rotatesAt null when nothing is due, on premium, and on self-host)",
    response: {
      schema: null,
      options: {
        inlineSchema: {
          type: 'object',
          properties: {
            count: { type: 'integer' },
            rotatesAt: { type: 'string', nullable: true },
            windowDays: { type: 'integer' },
            noticeDays: { type: 'integer' },
          },
          required: ['count', 'rotatesAt', 'windowDays', 'noticeDays'],
        },
      },
    },
  })
  @Get('/retention-notice')
  public retentionNotice(
    @CurrentUser() currentUser: User,
  ): Promise<IRetentionNotice> {
    return runPromise(this.retentionJob.notice(currentUser))
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
    return runPromise(this.timeRepository.findOneConfirmUser(time, currentUser))
  }

  @OpenAPIExtended({
    summary: 'Delete time entries (tracking worker only)',
    operation: {
      responses: {
        409: {
          description:
            'An invoice bills one of the entries; nothing was deleted, and the message names the invoice',
        },
      },
    },
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
  @Delete()
  @HttpCode(200)
  public async delete(
    @CurrentUser() currentUser: User,
    @Body() body: TimeIdsDto,
    @Res() res: express.Response,
  ): Promise<express.Response> {
    await runPromise(this.timeManager.removeMany(body.ids, currentUser))

    res.end()
    return res
  }
}
