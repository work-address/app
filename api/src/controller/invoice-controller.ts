import {
  Authorized,
  Body,
  Get,
  JsonController,
  Post,
} from 'routing-controllers'
import faker from 'faker'
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
        filter: { projectId: faker.datatype.uuid() },
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
    return this.invoiceRepository.findAndCount(search, currentUser)
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
  ) {
    return this.invoiceManager.create(data, project, currentUser)
  }

  @OpenAPIExtended({
    summary: 'Get invoice by id',
    response: {
      schema: Invoice,
      options: { serializationGroup: 'search' },
    },
  })
  @Get('/:id')
  public read(
    @CurrentUser() currentUser: User,
    @EntityFromParam({ paramName: 'id', relations: { project: true } })
    invoice: Invoice,
  ) {
    return this.invoiceRepository.findOneConfirmUser(invoice, currentUser)
  }
}
