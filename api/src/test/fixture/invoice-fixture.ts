import { inject, injectable } from 'inversify'
import { Project } from '../../entity/project'

import { InvoiceRepository } from '../../repository/invoice-repository'
import { Invoice } from '../../entity/invoice'
import { EInvoiceState } from '../../interface/invoice'

@injectable()
export class InvoiceFixture {
  @inject('InvoiceRepository')
  protected invoiceRepository: InvoiceRepository

  public create(
    project: Project,
    amount: number,
    state: EInvoiceState,
  ): Promise<Invoice> {
    const invoice = new Invoice()

    invoice.project = project
    invoice.amount = amount
    invoice.state = state

    return this.invoiceRepository.saveSingle(invoice)
  }
}
