import {inject, injectable} from 'inversify';
import {Activity} from '../../entity/Activity';

import {InvoiceRepository} from '../../repository/InvoiceRepository';
import {Invoice} from '../../entity/Invoice';
import {EInvoiceState} from '../../interface/EInvoiceState';

@injectable()
export class InvoiceFixture {
  @inject('InvoiceRepository')
  protected invoiceRepository: InvoiceRepository;

  public create(activity: Activity, amount: number, state: EInvoiceState): Promise<Invoice> {
    const invoice = new Invoice();

    invoice.activity = activity;
    invoice.amount = amount;
    invoice.state = state;

    return this.invoiceRepository.saveSingle(invoice);
  }
}
