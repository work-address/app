import { inject, injectable } from 'inversify'
import { Project } from '@/entity/project'

import { InvoiceRepository } from '@/repository/invoice-repository'
import { Invoice } from '@/entity/invoice'
import { EInvoiceState } from '@/model/invoice'

@injectable()
export class InvoiceFixture {
  @inject('InvoiceRepository')
  protected invoiceRepository: InvoiceRepository

  /** `amountCents` - whole cents, matching the entity. */
  public create(
    project: Project,
    amountCents: number,
    state: EInvoiceState,
  ): Promise<Invoice> {
    const invoice = new Invoice()

    invoice.project = project
    invoice.amountCents = amountCents
    invoice.state = state
    invoice.fromAt = new Date(Date.now() - 86400000)
    invoice.toAt = new Date()

    return this.invoiceRepository.saveSingle(invoice)
  }
}
