import {
  Authorized,
  Body,
  Get,
  HttpCode,
  JsonController,
  Post,
} from 'routing-controllers'
import { faker } from '@faker-js/faker'
import { OpenAPIExtended } from '@/decorator/openapi/openapi-extended'
import { App } from '@/app/app'
import { CurrentUser } from '@/decorator/current-user'
import { EntityFromParam } from '@/decorator/entity-from-param'
import { Invoice } from '@/entity/invoice'
import { User } from '@/entity/user'
import { Project } from '@/entity/project'
import { EUserRole } from '@/model/user'
import { InvoiceManager } from '@/service/invoice-manager'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { InvoiceCreateDto, InvoiceSearchDto } from '@/model/dto/invoice'
import { runPromise } from '@/service/effect-bridge'

@Authorized([EUserRole.ROLE_USER])
@JsonController('/invoice')
export class InvoiceController {
  protected invoiceManager: InvoiceManager
  protected invoiceRepository: InvoiceRepository

  constructor() {
    this.invoiceManager = App.container.get('InvoiceManager')
    this.invoiceRepository = App.container.get('InvoiceRepository')
  }

  @OpenAPIExtended({
    summary: 'Search invoices accessible by the current user',
    searchRequestBody: {
      example: {
        filter: { projectId: faker.string.uuid() },
        sort: { fromAt: 'DESC' },
        page: 0,
      },
    },
    response: {
      schema: Invoice,
      options: { isPagination: true, serializationGroup: 'search' },
    },
  })
  @Post('/search')
  public search(
    @CurrentUser() currentUser: User,
    @Body() search: InvoiceSearchDto,
  ) {
    return runPromise(this.invoiceRepository.findAndCount(search, currentUser))
  }

  @OpenAPIExtended({
    summary: 'Create invoice from logged time in a range',
    body: {
      schema: InvoiceCreateDto,
      options: {
        example: {
          fromUnix: Date.now() - 86400000,
          toUnix: Date.now(),
        },
      },
    },
    response: {
      schema: Invoice,
      options: { serializationGroup: 'search' },
    },
  })
  @Post('/project/:projectId')
  public create(
    @CurrentUser() currentUser: User,
    @EntityFromParam({ paramName: 'projectId' }) project: Project,
    @Body() data: InvoiceCreateDto,
  ): Promise<Invoice | null> {
    // Three shapes on one route, so there is a single place deciding who may
    // invoice a project: an explicit selection, an explicit range, or - the
    // one the UI uses by default - everything outstanding, idempotently.
    if (data?.timeIds?.length) {
      return runPromise(
        this.invoiceManager.createFromTimeIds(
          project,
          currentUser,
          data.timeIds,
        ),
      )
    }

    if (data?.fromUnix === undefined || data?.toUnix === undefined) {
      return runPromise(
        this.invoiceManager.ensureForProject(project, currentUser),
      )
    }

    return runPromise(this.invoiceManager.create(data, project, currentUser))
  }

  @OpenAPIExtended({
    summary: 'Get invoice by id, with the time it bills and a roll-up',
    response: {
      schema: null,
      options: {
        // Everything the invoice page needs in one response: the invoice as
        // the list serializes it, plus the entries it bills. Composed by hand
        // because `serializationGroup` registers a single group's component,
        // and this response is two - `Invoice_search` for the record itself,
        // `invoiceRead` for the fields that only a single read populates.
        inlineSchema: {
          allOf: [
            { $ref: '#/components/schemas/Invoice_search' },
            {
              type: 'object',
              properties: {
                time: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Time_search' },
                },
                report: {
                  type: 'object',
                  properties: {
                    rateHour: { type: 'number' },
                    rateTotal: { type: 'number' },
                    minutes: { type: 'number' },
                    minutesActive: { type: 'number' },
                    minutesPaid: { type: 'number' },
                    minutesUnpaid: { type: 'number' },
                    keyboardKeys: { type: 'number' },
                    mouseKeys: { type: 'number' },
                    mouseDistance: { type: 'number' },
                  },
                },
              },
            },
          ],
        },
      },
      transformGroups: ['search', 'invoiceRead'],
    },
  })
  @Get('/:id')
  public read(
    @CurrentUser() currentUser: User,
    @EntityFromParam({ paramName: 'id', relations: { project: true } })
    invoice: Invoice,
  ) {
    return runPromise(this.invoiceManager.read(invoice, currentUser))
  }

  @OpenAPIExtended({
    summary: 'Mark an invoice paid (issuer only); marks its time paid too',
    response: {
      schema: Invoice,
      options: { serializationGroup: 'search' },
    },
  })
  @Post('/:id/paid')
  @HttpCode(200)
  public async markPaid(
    @CurrentUser() currentUser: User,
    @EntityFromParam({
      paramName: 'id',
      relations: { project: true, user: true },
    })
    invoice: Invoice,
  ): Promise<Invoice> {
    return runPromise(this.invoiceManager.markPaid(invoice, currentUser))
  }

  @OpenAPIExtended({
    summary: 'Revert an invoice to unpaid; releases its time back to unpaid',
    response: {
      schema: Invoice,
      options: { serializationGroup: 'search' },
    },
  })
  @Post('/:id/unpaid')
  @HttpCode(200)
  public async markUnpaid(
    @CurrentUser() currentUser: User,
    @EntityFromParam({
      paramName: 'id',
      relations: { project: true, user: true },
    })
    invoice: Invoice,
  ): Promise<Invoice> {
    return runPromise(this.invoiceManager.markUnpaid(invoice, currentUser))
  }
}
