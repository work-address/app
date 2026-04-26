import _ from 'lodash';
import {inject, injectable} from 'inversify';

import {Filter} from '../service/filter';
import {AbstractRepositoryTemplate} from './abstract-repository-template';
import {Invoice} from '../entity/invoice';
import {ISearch} from '../interface/search';
import {User} from '../entity/user';
import AccessException from '../exception/access-exception';

@injectable()
export class InvoiceRepository extends AbstractRepositoryTemplate<Invoice> {
  @inject('Filter')
  protected filter: Filter;
  protected target = Invoice;

  public async findOneConfirmUser(invoice: Invoice, user: User): Promise<Invoice> {
    const invoiceUser = await this.getRepo()
      .createQueryBuilder('invoice')
      .innerJoinAndSelect('invoice.project', 'project')
      .innerJoin('project.user', 'user')
      .andWhere('invoice.id = :invoiceId', {invoiceId: invoice.id})
      .andWhere('user.id = :userId', {userId: user.id})
      .select()
      .getOne();

    const p = invoiceUser;

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
