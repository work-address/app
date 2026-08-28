import _ from 'lodash'
import { inject, injectable } from 'inversify'

import { Filter } from '@/service/filter'
import { Entitlement } from '@/service/entitlement'
import { Brackets } from 'typeorm'

import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm'
import { Project } from '@/entity/project'
import { AbstractRepositoryTemplate } from '@/repository/abstract-repository-template'
import { Invoice } from '@/entity/invoice'

import { User } from '@/entity/user'
import AccessException from '@/exception/access-exception'
import { InvoiceSearchDto } from '@/model/dto/invoice'

@injectable()
export class InvoiceRepository extends AbstractRepositoryTemplate<Invoice> {
  @inject('Filter')
  protected filter: Filter
  @inject('Entitlement')
  protected entitlement: Entitlement
  protected target = Invoice

  /**
   * Who may see an invoice: whoever issued it, the owner of its project, and
   * that project's viewers.
   *
   * Workers see their own and no one else's - one contractor's rate and hours
   * are not the business of another contractor on the same project. Viewers
   * see all of them, which is the point of the role.
   *
   * Mirrors ProjectRepository.applyViewAccessFilter, including the premium
   * predicate being omitted entirely on self-hosted instances rather than
   * relying on column data.
   */
  private applyInvoiceAccessFilter(
    qb: SelectQueryBuilder<ObjectLiteral>,
    user: User,
  ): void {
    const { accessUserId, userAddress } = Project.accessParams(user)

    qb.andWhere(
      new Brackets((scope) => {
        scope
          .where('issuer.id = :accessUserId', { accessUserId })
          .orWhere('owner.id = :accessUserId', { accessUserId })
          .orWhere(
            new Brackets((viewer) => {
              const isViewerAddress = `:userAddress = ANY(SELECT lower(address) FROM unnest(COALESCE(project.viewerAddresses, '{}')) AS address)`

              if (this.entitlement.shouldFilterByPremium()) {
                viewer
                  .where('owner.premium = true')
                  .andWhere(isViewerAddress, { userAddress })
              } else {
                viewer.where(isViewerAddress, { userAddress })
              }
            }),
          )
      }),
    )
  }

  public async findOneConfirmUser(
    invoice: Invoice,
    user: User,
  ): Promise<Invoice> {
    const qb = this.getRepo()
      .createQueryBuilder('invoice')
      .innerJoinAndSelect('invoice.project', 'project')
      .innerJoin('project.user', 'owner')
      .leftJoinAndSelect('invoice.user', 'issuer')
      .andWhere('invoice.id = :invoiceId', { invoiceId: invoice.id })

    this.applyInvoiceAccessFilter(qb, user)

    const invoiceUser = await qb.select().getOne()

    const p = invoiceUser

    if (!p) {
      throw new AccessException()
    }

    return p
  }

  /**
   * The author's most recent invoice on a project.
   *
   * Used when nothing is outstanding: the caller asked for "my invoice for
   * this project" and there is nothing new to raise, so they get the last one
   * rather than an error or a duplicate.
   */
  public async findLatestForAuthor(
    project: Project,
    author: User,
  ): Promise<Invoice | null> {
    return this.getRepo()
      .createQueryBuilder('invoice')
      .innerJoinAndSelect('invoice.project', 'project')
      .leftJoinAndSelect('invoice.user', 'issuer')
      .andWhere('project.id = :projectId', { projectId: project.id })
      .andWhere('issuer.id = :authorId', { authorId: author.id })
      .orderBy('invoice.createdAt', 'DESC')
      .getOne()
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
      .getManyAndCount()
  }
}
