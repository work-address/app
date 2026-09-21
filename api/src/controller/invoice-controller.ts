import {
  Authorized,
  Body,
  Get,
  HttpCode,
  JsonController,
  Post,
  QueryParams,
} from 'routing-controllers'
import { faker } from '@faker-js/faker'
import { SchemaObject } from 'openapi3-ts'
import { OpenAPIExtended } from '@/decorator/openapi/openapi-extended'
import { App } from '@/app/app'
import { CurrentUser } from '@/decorator/current-user'
import { EntityFromParam } from '@/decorator/entity-from-param'
import { Invoice } from '@/entity/invoice'
import { User } from '@/entity/user'
import { Project } from '@/entity/project'
import { EUserRole } from '@/model/user'
import {
  EInvoiceBasis,
  IInvoiceEscrowSubmission,
  IInvoiceRecord,
} from '@/model/invoice'
import { InvoiceManager } from '@/service/invoice-manager'
import { InvoiceRepository } from '@/repository/invoice-repository'
import {
  InvoiceCreateDto,
  InvoiceEscrowSubmissionQueryDto,
  InvoiceSearchDto,
} from '@/model/dto/invoice'
import { runPromise } from '@/service/effect-bridge'

@Authorized([EUserRole.ROLE_USER])
@JsonController('/invoice')
export class InvoiceController {
  protected invoiceManager: InvoiceManager
  protected invoiceRepository: InvoiceRepository

  /** One billed entry of an invoice's snapshot (`IInvoiceLine`). */
  private static readonly LINE_SCHEMA: SchemaObject = {
    type: 'object',
    required: ['timeId', 'fromAt', 'toAt', 'minutesActive'],
    properties: {
      timeId: { type: 'string' },
      fromAt: { type: 'string' },
      toAt: { type: 'string' },
      minutesActive: { type: 'integer' },
    },
  }

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
        // Fixed, not the clock, so the exported spec is the same on every
        // export: the day before 2024-01-21T09:00Z.
        example: {
          fromUnix: 1705741200000,
          toUnix: 1705827600000,
        },
      },
    },
    response: {
      schema: Invoice,
      options: { serializationGroup: 'search' },
    },
  })
  /**
   * The manual route, and the policy it keeps now that a schedule exists
   * (WP-97).
   *
   * It stays, unchanged and always available. Somebody who needs to bill
   * before the week closes - a contract ending mid-week, a client who asks
   * for it - presses the button, and nothing about the project's cadence
   * stops them. The two cannot double-bill, for two separate reasons:
   *
   * - both only ever bill time no invoice already covers, so whichever comes
   *   first takes the hours out of the other's reach;
   * - a manual invoice records no cadence period, and the unique key that
   *   holds the schedule to one invoice per period never compares rows
   *   carrying nulls, so a manual invoice neither blocks a scheduled one nor
   *   is blocked by it.
   *
   * What a manual invoice does *not* do is satisfy the period: if work is
   * logged afterwards, the schedule still raises that period's invoice for
   * what is left, which is the intended behaviour - the schedule bills what
   * is outstanding, not "once per week whatever happens".
   */
  @Post('/project/:projectId')
  public create(
    @CurrentUser() currentUser: User,
    @EntityFromParam({ paramName: 'projectId' }) project: Project,
    @Body() data: InvoiceCreateDto,
  ): Promise<Invoice | null> {
    // Three shapes on one route, so there is a single place deciding who may
    // invoice a project: an explicit selection, an explicit range, or - the
    // one the UI uses by default - everything outstanding, idempotently.
    // InvoiceCreateDto has already refused an empty selection and a range
    // with one bound, so neither can fall through to "everything".
    if (Array.isArray(data?.timeIds)) {
      return runPromise(
        this.invoiceManager.createFromTimeIds(
          project,
          currentUser,
          data.timeIds,
        ),
      )
    }

    if (data?.fromUnix === undefined && data?.toUnix === undefined) {
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
                // The billed entries as frozen at issuance; null on a legacy
                // invoice, which never recorded them.
                lines: {
                  type: 'array',
                  nullable: true,
                  items: InvoiceController.LINE_SCHEMA,
                },
                report: {
                  type: 'object',
                  properties: {
                    // Null on a legacy invoice: its rate was never recorded.
                    rateHour: { type: 'number', nullable: true },
                    rateTotal: { type: 'number', nullable: true },
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
    summary:
      'Get the InvoiceRecord v1 of an invoice - the canonical document an escrow invoice commitment hashes',
    operation: {
      responses: {
        409: {
          description:
            'The invoice was issued before invoices kept a snapshot, or its snapshot lacks a field the record carries (its issuer, say), so it has no record',
        },
      },
    },
    response: {
      schema: null,
      options: {
        inlineSchema: {
          type: 'object',
          required: [
            'version',
            'invoiceId',
            'projectId',
            'issuerId',
            'issuerAddress',
            'ownerAddress',
            'currency',
            'rateHourCents',
            'minutesActive',
            'amountCents',
            'periodStart',
            'periodEnd',
            'lines',
          ],
          properties: {
            version: { type: 'integer' },
            invoiceId: { type: 'string' },
            projectId: { type: 'string' },
            issuerId: { type: 'string' },
            issuerAddress: { type: 'string' },
            ownerAddress: { type: 'string' },
            currency: { type: 'string' },
            rateHourCents: { type: 'integer' },
            minutesActive: { type: 'integer' },
            amountCents: { type: 'integer' },
            periodStart: { type: 'string' },
            periodEnd: { type: 'string' },
            lines: { type: 'array', items: InvoiceController.LINE_SCHEMA },
            // A FIXED invoice's record only: what the agreed sum is for.
            basis: { type: 'string', enum: [EInvoiceBasis.FIXED] },
            milestoneRef: { type: 'string' },
            description: { type: 'string' },
          },
        },
      },
    },
  })
  @Get('/:id/record')
  public record(
    @CurrentUser() currentUser: User,
    @EntityFromParam({ paramName: 'id' }) invoice: Invoice,
  ): Promise<IInvoiceRecord> {
    return runPromise(this.invoiceManager.record(invoice, currentUser))
  }

  @OpenAPIExtended({
    summary:
      "Get the amount and InvoiceCommitment v1 to submit this invoice to the escrow allocation funding its marketplace contract's work period (the hired worker who issued it only); the first call binds the invoice to that allocation",
    operation: {
      responses: {
        403: {
          description:
            'The caller did not issue the invoice, or is not the worker hired on its project',
        },
        409: {
          description:
            "The invoice is legacy, already paid, for nothing, outside the work period, on a project no marketplace contract hired for, or bound to another allocation; the allocation does not derive from the invoice's contract and that period; or the allocation already bills another invoice",
        },
      },
    },
    response: {
      schema: null,
      options: {
        inlineSchema: {
          type: 'object',
          required: [
            'invoiceId',
            'chainId',
            'escrow',
            'allocationId',
            'amountBaseUnits',
            'invoiceCommitment',
            'salt',
          ],
          properties: {
            invoiceId: { type: 'string' },
            chainId: { type: 'integer' },
            escrow: { type: 'string' },
            allocationId: { type: 'string' },
            // Token base units (USDT, 6 decimals) as a decimal string.
            amountBaseUnits: { type: 'string' },
            invoiceCommitment: { type: 'string' },
            salt: { type: 'string' },
          },
        },
      },
    },
  })
  @Get('/:id/escrow-submission')
  public escrowSubmission(
    @CurrentUser() currentUser: User,
    @EntityFromParam({ paramName: 'id' }) invoice: Invoice,
    @QueryParams() query: InvoiceEscrowSubmissionQueryDto,
  ): Promise<IInvoiceEscrowSubmission> {
    return runPromise(
      this.invoiceManager.escrowSubmission(invoice, currentUser, query),
    )
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
