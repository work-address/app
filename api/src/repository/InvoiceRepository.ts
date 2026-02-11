import _ from 'lodash';
import {inject, injectable} from 'inversify';

import {Filter} from '../service/Filter';
import {AbstractRepositoryTemplate} from './AbstractRepositoryTemplate';
import {Invoice} from '../entity/Invoice';
import {ISearch} from '../interface/search/ISearch';
import {User} from '../entity/User';
import AccessException from '../exception/AccessException';

@injectable()
export class InvoiceRepository extends AbstractRepositoryTemplate<Invoice> {
  @inject('Filter')
  protected filter: Filter;
  protected target = Invoice;

  public async findOneConfirmUser(invoice: Invoice, user: User): Promise<Invoice> {
    const invoiceBusiness = await this.getRepo()
      .createQueryBuilder('invoice')
      .innerJoinAndSelect('invoice.activity', 'activity')
      .innerJoin('activity.user', 'business')
      .andWhere('invoice.id = :invoiceId', {invoiceId: invoice.id})
      .andWhere('business.id = :businessId', {businessId: user.id})
      .select()
      .getOne();

    const invoiceFreelancer = await this.getRepo()
      .createQueryBuilder('invoice')
      .innerJoinAndSelect('invoice.activity', 'activity')
      .innerJoin('activity.proposalAccepted', 'proposal')
      .innerJoin('proposal.user', 'freelancer')
      .andWhere('invoice.id = :invoiceId', {invoiceId: invoice.id})
      .andWhere('freelancer.id = :freelancerId', {freelancerId: user.id})
      .select()
      .getOne();

    const p = invoiceFreelancer || invoiceBusiness;

    if (!p) {
      throw new AccessException();
    }

    return p;
  }

  public async findAndCount(search: ISearch): Promise<[Invoice[], number]> {
    const s = _.assign(
      {
        filter: {},
        sort: {
          createdAt: 'ASC',
        },
        page: 0,
      },
      search
    );
    const sort = this.filter.buildOrderByCondition('invoice', s);
    const limit = this.filter.buildLimit(search);

    return this.getRepo()
      .createQueryBuilder('invoice')
      .select()
      .orderBy(sort)
      .skip(limit * s.page)
      .take(limit)
      .getManyAndCount();
  }
}
