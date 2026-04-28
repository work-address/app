import {
  Authorized,
  Body,
  Get,
  JsonController,
  Post,
  ResponseClassTransformOptions,
} from 'routing-controllers'
import faker from 'faker'
import { OpenAPI } from 'routing-controllers-openapi'

import { App } from '@/app/app'
import { User } from '@/entity/user'
import { ExtendedResponseSchema } from '@/decorator/extended-response-schema'
import { EUserRole } from '@/interface/user'
import { AbstractController } from '@/controller/abstract-controller'
import { CurrentUser } from '@/decorator/current-user'
import { InvoiceManager } from '@/service/invoice-manager'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { InvoiceSearchDto } from '@/validator/dto/invoice-search-dto'
import { Invoice } from '@/entity/invoice'
import { EntityFromParam } from '@/decorator/entity-from-param'
import { InvoiceCreateDto } from '@/validator/dto/invoice-create-dto'
import { Project } from '@/entity/project'
import { OpenApi } from '@/service/open-api'

@Authorized([EUserRole.ROLE_USER])
@JsonController('/invoice')
export class InvoiceController extends AbstractController {
  protected invoiceManager: InvoiceManager
  protected invoiceRepository: InvoiceRepository

  constructor() {
    super()

    this.invoiceManager = App.container.get('InvoiceManager')
    this.invoiceRepository = App.container.get('InvoiceRepository')
  }

  @OpenAPI({
    summary: 'Search invoices for the current user',
    description: '`filter.projectId` scopes results to one project.',
    parameters: [OpenApi.bearerAuthParameter],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: OpenApi.searchRequestBodySchema,
          example: {
            filter: { projectId: faker.datatype.uuid() },
            sort: { fromAt: 'DESC' },
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
  @ExtendedResponseSchema(Invoice, { isPagination: true })
  @ResponseClassTransformOptions({ groups: ['search'] })
  public search(@Body() search: InvoiceSearchDto) {
    return this.invoiceRepository.findAndCount(search)
  }

  @OpenAPI({
    summary: 'Create invoice from logged time in a range',
    description:
      'Project owner only: `projectId` must be a project you own. Computes `amount` from the project `rateHour` and time entries between `fromUnix` and `toUnix` (UTC ms).',
    parameters: [
      OpenApi.bearerAuthParameter,
      {
        in: 'path',
        name: 'projectId',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['fromUnix', 'toUnix'],
            properties: {
              fromUnix: {
                type: 'number',
                description: 'Range start (Unix ms, UTC)',
              },
              toUnix: {
                type: 'number',
                description: 'Range end (Unix ms, UTC)',
              },
            },
          },
          example: {
            fromUnix: Date.now() - 86400000,
            toUnix: Date.now(),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Persisted invoice (search serialization group)',
        content: {
          'application/json': {
            schema: { type: 'object' },
          },
        },
      },
    },
  })
  @Post('/project/:projectId')
  public create(
    @CurrentUser() currentUser: User,
    @EntityFromParam('projectId') project: Project,
    @Body() data: InvoiceCreateDto,
  ) {
    return this.invoiceManager.create(data, project, currentUser)
  }

  @OpenAPI({
    summary: 'Get invoice by id',
    parameters: [
      OpenApi.bearerAuthParameter,
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    responses: {
      200: {
        description:
          'Invoice if the user may access it (includes nested project)',
        content: {
          'application/json': {
            schema: { type: 'object' },
          },
        },
      },
    },
  })
  @Get('/:id')
  @ExtendedResponseSchema(Invoice)
  @ResponseClassTransformOptions({ groups: ['search'] })
  public read(
    @CurrentUser() currentUser: User,
    @EntityFromParam('id', null, { project: true }) invoice: Invoice,
  ) {
    return this.invoiceRepository.findOneConfirmUser(invoice, currentUser)
  }
}
