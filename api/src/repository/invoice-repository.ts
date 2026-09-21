import _ from 'lodash'
import { inject, injectable } from 'inversify'

import { Filter } from '@/service/filter'
import { Brackets, IsNull } from 'typeorm'

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
import InvoiceEscrowException from '@/exception/invoice-escrow-exception'
import { InvoiceSearchDto } from '@/model/dto/invoice'
import {
  EInvoiceIssuanceKind,
  EInvoiceSnapshotVersion,
  IInvoiceCommitmentBinding,
} from '@/model/invoice'

@injectable()
export class InvoiceRepository extends AbstractRepositoryTemplate<Invoice> {
  @inject('Filter')
  protected filter: Filter
  protected target = Invoice

  /** Postgres SQLSTATE for a unique index refusing a row. */
  private static readonly UNIQUE_VIOLATION = '23505'

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

  /**
   * Marks every invoice issued before invoices kept a financial snapshot as
   * legacy, and returns how many it marked.
   *
   * Only the version changes. The rate such an invoice was raised at was
   * never recorded, and today's project rate is not it, so nothing else is
   * filled in: a legacy invoice keeps its frozen amount and reports no rate.
   * Rows already marked, and every invoice carrying a snapshot, are left
   * alone, so a second run marks nothing. Soft-deleted invoices are marked
   * too - restoring one must not bring back an unmarked row.
   */
  public markUnsnapshottedAsLegacy(): RepoEffect<number> {
    return fromPromise(async () => {
      const result = await this.getRepo()
        .createQueryBuilder()
        .update(Invoice)
        .set({ snapshotVersion: EInvoiceSnapshotVersion.LEGACY })
        .where({ snapshotVersion: IsNull() })
        .execute()

      return result.affected ?? 0
    })
  }

  /**
   * The invoice as it stands now, with its row locked until the caller's
   * transaction ends.
   *
   * Marking paid and unpaid read the state they are about to change through
   * here rather than trusting the copy loaded with the request, so two
   * concurrent marks on one invoice run one after the other and the second
   * sees what the first did. No joins: `FOR UPDATE` would lock the project
   * and issuer rows too.
   */
  public findOneForUpdate(invoice: Invoice): RepoEffect<Invoice> {
    return fromPromise(() =>
      this.getRepo()
        .createQueryBuilder('invoice')
        .andWhere('invoice.id = :invoiceId', { invoiceId: invoice.id })
        .setLock('pessimistic_write')
        .getOneOrFail(),
    )
  }

  /**
   * The invoice an escrow allocation bills, if any - soft-deleted ones
   * included, since the unique index counts them too.
   */
  public findByEscrowAllocation(
    binding: IInvoiceCommitmentBinding,
  ): RepoEffect<Invoice | null> {
    return fromPromise(() =>
      this.getRepo().findOne({
        where: {
          escrowChainId: binding.chainId,
          escrowAddress: binding.escrow,
          escrowAllocationId: binding.allocationId,
        },
        withDeleted: true,
      }),
    )
  }

  /**
   * Binds the invoice to an escrow allocation under a commitment, writing
   * only those columns.
   *
   * Only an unbound row is written, so a binding is never moved. A second
   * invoice racing for the same allocation fails the unique index; that is
   * reported as the conflict it is rather than a database error.
   */
  public bindEscrow(
    invoice: Invoice,
    binding: IInvoiceCommitmentBinding,
    commitment: string,
    salt: string,
  ): RepoEffect<void> {
    return fromPromise(async () => {
      try {
        const result = await this.getRepo()
          .createQueryBuilder()
          .update(Invoice)
          .set({
            escrowChainId: binding.chainId,
            escrowAddress: binding.escrow,
            escrowAllocationId: binding.allocationId,
            escrowCommitment: commitment,
            escrowSalt: salt,
          })
          .where('id = :id', { id: invoice.id })
          .andWhere('"escrowAllocationId" IS NULL')
          .execute()

        if (result.affected !== 1) {
          throw new InvoiceEscrowException(
            `Invoice ${invoice.id} is already submitted to an escrow allocation`,
          )
        }
      } catch (error: unknown) {
        if (
          (error as { code?: string }).code ===
          InvoiceRepository.UNIQUE_VIOLATION
        ) {
          throw new InvoiceEscrowException(
            `Allocation ${binding.allocationId} already bills another invoice`,
          )
        }

        throw error
      }
    })
  }

  /**
   * The scheduled invoice this project's cadence already raised for one
   * issuer and one period, if it has.
   *
   * Read inside the issuing transaction so a rerun answers with the invoice
   * the first run made rather than trying to insert a second; the unique key
   * on the entity is what catches two runs that read at the same moment.
   * Soft-deleted rows count, exactly as they do for the escrow binding: the
   * constraint compares them too.
   */
  public findScheduledForPeriod(
    project: Project,
    issuer: User,
    period: { start: Date; end: Date },
  ): RepoEffect<Invoice | null> {
    return fromPromise(() =>
      this.getRepo().findOne({
        where: {
          project: { id: project.id },
          user: { id: issuer.id },
          periodStart: period.start,
          periodEnd: period.end,
          issuanceKind: EInvoiceIssuanceKind.SCHEDULED,
        },
        withDeleted: true,
      }),
    )
  }

  /** Whether an error is the unique key above refusing a duplicate row. */
  public static isDuplicatePeriod(error: unknown): boolean {
    return (
      (error as { code?: string }).code === InvoiceRepository.UNIQUE_VIOLATION
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
