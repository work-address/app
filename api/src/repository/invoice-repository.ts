import _ from 'lodash'
import { inject, injectable } from 'inversify'

import { Filter } from '@/service/filter'
import { AbstractRepositoryTemplate } from '@/repository/abstract-repository-template'
import { Invoice } from '@/entity/invoice'

import { User } from '@/entity/user'
import AccessException from '@/exception/access-exception'
import { InvoiceSearchDto } from '@/model/dto/invoice'

@injectable()
export class InvoiceRepository extends AbstractRepositoryTemplate<Invoice> {
  @inject('Filter')
  protected filter: Filter
  protected target = Invoice

  public async findOneConfirmUser(
    invoice: Invoice,
    user: User,
  ): Promise<Invoice> {
    const invoiceUser = await this.getRepo()
      .createQueryBuilder('invoice')
      .innerJoinAndSelect('invoice.project', 'project')
      .innerJoin('project.user', 'user')
      .andWhere('invoice.id = :invoiceId', { invoiceId: invoice.id })
      .andWhere('user.id = :userId', { userId: user.id })
      .select()
      .getOne()

    const p = invoiceUser

    if (!p) {
      throw new AccessException()
    }

    return p
  }

  public async findAndCount(
    search: InvoiceSearchDto,
    user: User,
  ): Promise<[Invoice[], number]> {
    const s = _.assign(
      {
        filter: {},
        sort: {
          createdAt: 'ASC',
        },
        page: 0,
      },
      search,
    )
    const sort = this.filter.buildOrderByCondition('invoice', s)
    const limit = this.filter.buildLimit(search)

    return this.getRepo()
      .createQueryBuilder('invoice')
      .innerJoinAndSelect('invoice.project', 'project')
      .innerJoin('project.user', 'user')
      .select()
      .where((qb) => {
        qb.andWhere('user.id = :userId', { userId: user.id })

        if ('projectId' in s.filter) {
          qb.andWhere('project.id = :projectId', {
            projectId: s.filter.projectId,
          })
        }
        if ('fromAt' in s.filter) {
          qb.andWhere('invoice.fromAt >= :fromAt', {
            fromAt: s.filter.fromAt,
          })
        }
        if ('toAt' in s.filter) {
          qb.andWhere('invoice.toAt <= :toAt', {
            toAt: s.filter.toAt,
          })
        }
        if ('amountFrom' in s.filter) {
          qb.andWhere('invoice.amount >= :amountFrom', {
            amountFrom: s.filter.amountFrom,
          })
        }
        if ('amountTo' in s.filter) {
          qb.andWhere('invoice.amount <= :amountTo', {
            amountTo: s.filter.amountTo,
          })
        }
        if ('state' in s.filter) {
          qb.andWhere('invoice.state = :state', {
            state: s.filter.state,
          })
        }
      })
      .orderBy(sort)
      .skip(limit * s.page)
      .take(limit)
      .getManyAndCount()
  }
}
