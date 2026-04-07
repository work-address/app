import {
  Authorized,
  Body,
  Get,
  JsonController,
  Post,
  ResponseClassTransformOptions,
} from 'routing-controllers';
import faker from 'faker';
import {OpenAPI} from 'routing-controllers-openapi';

import {App} from '../app/App';
import {User} from '../entity/User';
import {ExtendedResponseSchema} from '../decorator/ExtendedResponseSchema';
import {EUserRole} from '../interface/EUserRole';
import {AbstractController} from './AbstractController';
import {CurrentUser} from '../decorator/CurrentUser';
import {InvoiceManager} from '../service/InvoiceManager';
import {InvoiceRepository} from '../repository/InvoiceRepository';
import {InvoiceSearchDto} from '../validator/dto/InvoiceSearchDto';
import {Invoice} from '../entity/Invoice';
import {EntityFromParam} from '../decorator/EntityFromParam';
import {InvoiceCreateDto} from '../validator/dto/InvoiceCreateDto';
import {Activity} from '../entity/Activity';
import {OpenApi} from '../service/OpenApi';

@Authorized([EUserRole.ROLE_USER])
@JsonController('/invoice')
export class InvoiceController extends AbstractController {
  protected invoiceManager: InvoiceManager;
  protected invoiceRepository: InvoiceRepository;

  constructor() {
    super();

    this.invoiceManager = App.container.get('InvoiceManager');
    this.invoiceRepository = App.container.get('InvoiceRepository');
  }

  @OpenAPI({
    summary: 'Search invoices for the current user',
    description: '`filter.activityId` scopes results to one activity.',
    parameters: [OpenApi.bearerAuthParameter],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: OpenApi.searchRequestBodySchema,
          example: {
            filter: {activityId: faker.datatype.uuid()},
            sort: {fromAt: 'DESC'},
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
  @ExtendedResponseSchema(Invoice, {isPagination: true})
  @ResponseClassTransformOptions({groups: ['search']})
  public search(@Body() search: InvoiceSearchDto) {
    return this.invoiceRepository.findAndCount(search);
  }

  @OpenAPI({
    summary: 'Create invoice from logged time in a range',
    description:
      'Freelancer-only: `activityId` must be an activity they are assigned to. Computes amount from accepted proposal rate and time entries between `fromUnix` and `toUnix` (UTC ms).',
    parameters: [
      OpenApi.bearerAuthParameter,
      {
        in: 'path',
        name: 'activityId',
        required: true,
        schema: {type: 'string', format: 'uuid'},
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
              fromUnix: {type: 'number', description: 'Range start (Unix ms, UTC)'},
              toUnix: {type: 'number', description: 'Range end (Unix ms, UTC)'},
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
            schema: {type: 'object'},
          },
        },
      },
    },
  })
  @Post('/activity/:activityId')
  public create(
    @CurrentUser() currentUser: User,
    @EntityFromParam('activityId') activity: Activity,
    @Body() data: InvoiceCreateDto
  ) {
    return this.invoiceManager.create(data, activity, currentUser);
  }

  @OpenAPI({
    summary: 'Get invoice by id',
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
      200: {
        description: 'Invoice if the user may access it (includes nested activity)',
        content: {
          'application/json': {
            schema: {type: 'object'},
          },
        },
      },
    },
  })
  @Get('/:id')
  @ExtendedResponseSchema(Invoice)
  @ResponseClassTransformOptions({groups: ['search']})
  public read(
    @CurrentUser() currentUser: User,
    @EntityFromParam('id', null, {activity: true}) invoice: Invoice
  ) {
    return this.invoiceRepository.findOneConfirmUser(invoice, currentUser);
  }
}
