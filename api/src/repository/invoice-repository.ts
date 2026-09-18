import _ from 'lodash'
import { inject, injectable } from 'inversify'

import { Filter } from '@/service/filter'
import { Brackets } from 'typeorm'

import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm'
import { Project } from '@/entity/project'
import {
  AbstractRepositoryTemplate,
  RepoEffect,
} from '@/repository/abstract-repository-template'
import { fromPromise } from '@/service/effect-bridge'
import { Invoice } from '@/entity/invoice'

import { User } from '@/entity/user'
import AccessException from '@/exception/access-exception'
import { InvoiceSearchDto } from '@/model/dto/invoice'

@injectable()
export class InvoiceRepository extends AbstractRepositoryTemplate<Invoice> {
  @inject('Filter')
  protected filter: Filter
  protected target = Invoice

  /**
   * Who may see an invoice: whoever issued it, and the owner of its project.
   * Nobody else - see "Who can see what" in SPEC.md.
   *
   * Workers see their own and no one else's - one contractor's rate and hours
   * are not the business of another contractor on the same project. Viewers
   * see none at all: the role exists to watch progress, not money, and a
   * viewer is usually further from the contributors than a fellow worker is.
   *
   * Access follows the issuer, not the issuer's current role, so a worker
   * later moved to the viewer list keeps sight of the invoices they raised.
   * The project's collaborator lists play no part in the predicate at all.
   */
  private applyInvoiceAccessFilter(
    qb: SelectQueryBuilder<ObjectLiteral>,
    user: User,
  ): void {
    const accessUserId = user.id

    qb.andWhere(
      new Brackets((scope) => {
        scope
          .where('issuer.id = :accessUserId', { accessUserId })
          .orWhere('owner.id = :accessUserId', { accessUserId })
      }),
    )
  }

  public findOneConfirmUser(invoice: Invoice, user: User): RepoEffect<Invoice> {
    const qb = this.getRepo()
      .createQueryBuilder('invoice')
      .innerJoinAndSelect('invoice.project', 'project')
      .innerJoin('project.user', 'owner')
      .leftJoinAndSelect('invoice.user', 'issuer')
      .andWhere('invoice.id = :invoiceId', { invoiceId: invoice.id })

    this.applyInvoiceAccessFilter(qb, user)

    return fromPromise(async () => {
      const invoiceUser = await qb.select().getOne()

      if (!invoiceUser) {
        throw new AccessException()
      }

      return invoiceUser
    })
  }

  /**
   * The author's most recent invoice on a project.
   *
   * Used when nothing is outstanding: the caller asked for "my invoice for
   * this project" and there is nothing new to raise, so they get the last one
   * rather than an error or a duplicate.
   */
  public findLatestForAuthor(
    project: Project,
    author: User,
  ): RepoEffect<Invoice | null> {
    return fromPromise(() =>
      this.getRepo()
        .createQueryBuilder('invoice')
        .innerJoinAndSelect('invoice.project', 'project')
        .leftJoinAndSelect('invoice.user', 'issuer')
        .andWhere('project.id = :projectId', { projectId: project.id })
        .andWhere('issuer.id = :authorId', { authorId: author.id })
        .orderBy('invoice.createdAt', 'DESC')
        .getOne(),
    )
  }

  public findAndCount(
    search: InvoiceSearchDto,
    user: User,
  ): RepoEffect<[Invoice[], number]> {
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

    return fromPromise(() =>
      this.getRepo()
        .createQueryBuilder('invoice')
        .innerJoinAndSelect('invoice.project', 'project')
        .innerJoin('project.user', 'owner')
        .leftJoinAndSelect('invoice.user', 'issuer')
        .select()
        // `.where()` REPLACES every condition set before it, so the access
        // filter has to be applied after the filter block opens it - applying it
        // first silently drops it and returns every invoice in the table.
        .where((qb) => {
          this.applyInvoiceAccessFilter(qb, user)

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
            qb.andWhere('invoice.amountCents >= :amountFrom', {
              amountFrom: s.filter.amountFrom,
            })
          }
          if ('amountTo' in s.filter) {
            qb.andWhere('invoice.amountCents <= :amountTo', {
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
        .getManyAndCount(),
    )
  }
}
