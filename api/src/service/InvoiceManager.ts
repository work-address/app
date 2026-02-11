import {inject, injectable} from 'inversify';

import {Invoice} from '../entity/Invoice';
import {InvoiceRepository} from '../repository/InvoiceRepository';
import {User} from '../entity/User';
import {InvoiceCreateDto} from '../validator/dto/InvoiceCreateDto';
import moment from 'moment';
import {ActivityRepository} from '../repository/ActivityRepository';
import {Activity} from '../entity/Activity';
import RejectedExecutionException from '../exception/RejectedExecutionException';
import {TimeRepository} from '../repository/TimeRepository';

@injectable()
export class InvoiceManager {
  @inject('TimeRepository')
  protected invoiceRepository: InvoiceRepository;
  @inject('ActivityRepository')
  protected activityRepository: ActivityRepository;
  @inject('TimeRepository')
  protected timeRepository: TimeRepository;

  public async create(
    data: InvoiceCreateDto,
    activity: Activity,
    freelancer: User
  ): Promise<Invoice> {
    const invoice = new Invoice();

    const activityExisting = await this.activityRepository.findActivityByFreelancer(
      activity,
      freelancer
    );

    if (!activityExisting) {
      throw new RejectedExecutionException(
        `Wrong user: the given activity belongs to someone else`
      );
    }

    const times = await this.timeRepository.findTimeBetweenForActivity(
      data.fromUnix,
      data.toUnix,
      activity,
      freelancer
    );

    invoice.fromAt = moment.utc(data.fromUnix).toDate();
    invoice.toAt = moment.utc(data.toUnix).toDate();
    invoice.activity = activity;
    invoice.amount = activity.proposalAccepted?.rate || 0 * times.length; // Rate calculation

    return this.invoiceRepository.validateAndSave(invoice);
  }
}
