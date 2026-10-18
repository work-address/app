import _ from 'lodash'
import { inject, injectable } from 'inversify'

import { Filter } from '@/service/filter'
import { Entitlement } from '@/service/entitlement'
import { Brackets, In } from 'typeorm'
import { Time } from '@/entity/time'
import { TimeAgent } from '@/entity/time-agent'
import { AgentRepository } from '@/repository/agent-repository'
import { EInvoiceState } from '@/model/invoice'
import { InvoiceSnapshot } from '@/service/invoice-snapshot'
import { BadRequestError } from 'routing-controllers'

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
  @inject('AgentRepository') protected agents: AgentRepository
  @inject('Filter')
  protected filter: Filter
  @inject('Entitlement')
  protected entitlement: Entitlement
  protected target = Invoice

  /** Invoices are private to their issuer and the project owner. */
  private applyInvoiceAccessFilter(
    qb: SelectQueryBuilder<ObjectLiteral>,
    user: User,
  ): void {
    const { accessUserId } = Project.accessParams(user)

    qb.andWhere(
      new Brackets((scope) => {
        scope
          .where('issuer.id = :accessUserId', { accessUserId })
          .orWhere('owner.id = :accessUserId', { accessUserId })
      }),
    )
  }

  public saveWithEntries(
    invoice: Invoice,
    selected: Time[],
    reuseExisting = false,
  ): RepoEffect<Invoice> {
    return fromPromise(() =>
      this.getRepo().manager.transaction(async (manager) => {
        await manager.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
          [`invoice:${invoice.project.id}:${invoice.user!.id}`],
        )
        const project = await manager
          .getRepository(Project)
          .createQueryBuilder('project')
          .innerJoinAndSelect('project.user', 'owner')
          .where('project.id=:id', { id: invoice.project.id })
          .setLock('pessimistic_read', undefined, ['project'])
          .getOneOrFail()
        if (
          !project.isWorker(
            invoice.user!,
            this.entitlement.isPremium(project.user),
          )
        )
          throw new AccessException()
        const times = await manager
          .getRepository(Time)
          .createQueryBuilder('time')
          .where('time.id IN (:...ids)', { ids: selected.map((t) => t.id) })
          .andWhere('time.userId=:user AND time.projectId=:project', {
            user: invoice.user!.id,
            project: project.id,
          })
          .andWhere(
            'time.invoiceId IS NULL AND COALESCE(time.isPaid,false)=false',
          )
          .setLock('pessimistic_write')
          .getMany()
        if (times.length !== selected.length) {
          if (reuseExisting && times.length === 0) {
            const previous = await manager
              .getRepository(Time)
              .createQueryBuilder('time')
              .innerJoinAndSelect('time.invoice', 'invoice')
              .where('time.id IN (:...ids)', { ids: selected.map((t) => t.id) })
              .andWhere('time.userId=:user AND time.projectId=:project', {
                user: invoice.user!.id,
                project: project.id,
              })
              .getMany()
            if (
              previous.length === selected.length &&
              previous.every((t) => t.invoice?.id === previous[0].invoice?.id)
            )
              return previous[0].invoice!
          }
          throw new BadRequestError(
            'Some time is already invoiced or no longer available',
          )
        }
        const minutes = times.reduce(
          (sum, t) => sum + Math.max(0, (+t.toAt - +t.fromAt) / 60000),
          0,
        )
        const rateHourCents = Math.round(Number(project.rateHour || 0) * 100)
        invoice.amountCents = Math.round((minutes * rateHourCents) / 60)
        invoice.lines = [
          {
            kind: 'human',
            name: 'Human time',
            basis: 'tracked',
            minutes,
            activeMinutes: times.reduce(
              (sum, t) =>
                sum +
                Math.min(
                  Math.max(0, (+t.toAt - +t.fromAt) / 60000),
                  t.minutesActive || 0,
                ),
              0,
            ),
            manualMinutes: times
              .filter((t) => t.source !== 'desktop')
              .reduce((sum, t) => sum + (+t.toAt - +t.fromAt) / 60000, 0),
            rateHourCents,
            amountCents: invoice.amountCents,
            rateChanges: [],
          },
        ]
        const saved = await manager.save(Invoice, invoice)
        await manager.update(
          Time,
          { id: In(times.map((t) => t.id)) },
          { invoice: saved, publishedAt: new Date() },
        )
        return saved
      }),
    )
  }

  public reject(
    invoice: Invoice,
    actor: User,
    reason?: string,
  ): RepoEffect<Invoice> {
    return fromPromise(() =>
      this.getRepo().manager.transaction(async (manager) => {
        const stored = await manager.findOneOrFail(Invoice, {
          where: { id: invoice.id },
          loadEagerRelations: false,
          lock: { mode: 'pessimistic_write' },
        })
        const project = await manager.findOneOrFail(Project, {
          where: { id: invoice.project.id },
          relations: { user: true },
        })
        if (!project.isOwner(actor))
          throw new AccessException(
            'Only the project owner may reject an invoice',
          )
        if (stored.state !== EInvoiceState.REQUESTED)
          throw new BadRequestError('Only a requested invoice can be rejected')
        if (
          reason !== undefined &&
          (typeof reason !== 'string' || reason.length > 500)
        )
          throw new BadRequestError('Invalid rejection reason')
        if (stored.lines === null) {
          // Preserve the charged basis before unlinking the only legacy evidence.
          const times = await manager
            .createQueryBuilder(Time, 'time')
            .where('time.invoiceId=:id', { id: stored.id })
            .orderBy('time.id', 'ASC')
            .setLock('pessimistic_write')
            .getMany()
          stored.lines = [
            InvoiceSnapshot.legacyHuman(
              stored.amountCents,
              times.reduce((sum, time) => sum + (time.minutesActive || 0), 0),
            ),
          ]
        }
        stored.state = EInvoiceState.REJECTED
        stored.rejectionReason = reason?.trim() || null
        stored.rejectedAt = new Date()
        await this.agents.releaseInvoice(manager, stored.id)
        await manager.update(
          Time,
          { invoice: { id: stored.id } },
          { invoice: null, isPaid: false },
        )
        return manager.save(Invoice, stored)
      }),
    )
  }

  public setPaid(
    invoice: Invoice,
    actor: User,
    paid: boolean,
  ): RepoEffect<Invoice> {
    return fromPromise(() =>
      this.getRepo().manager.transaction(async (manager) => {
        const stored = await manager.findOneOrFail(Invoice, {
          where: { id: invoice.id },
          relations: { user: true },
        })
        await manager.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
          [`payment:${invoice.id}`],
        )
        const locked = await manager.findOneOrFail(Invoice, {
          where: { id: invoice.id },
          loadEagerRelations: false,
          lock: { mode: 'pessimistic_write' },
        })
        if (stored.user?.id !== actor.id)
          throw new AccessException(
            'Only the person who issued an invoice may change its payment state',
          )
        if (locked.state === EInvoiceState.REJECTED)
          throw new BadRequestError('A rejected invoice cannot be paid')
        locked.state = paid ? EInvoiceState.PAID : EInvoiceState.REQUESTED
        locked.paidAt = paid ? (locked.paidAt ?? new Date()) : null
        await manager.update(
          TimeAgent,
          { invoiceId: invoice.id, userId: actor.id },
          { isPaid: paid },
        )
        await manager.update(
          Time,
          { invoice: { id: invoice.id }, user: { id: actor.id } },
          { isPaid: paid },
        )
        return manager.save(Invoice, Object.assign(stored, locked))
      }),
    )
  }

  public findOneConfirmUser(invoice: Invoice, user: User): RepoEffect<Invoice> {
    const qb = this.getRepo()
      .createQueryBuilder('invoice')
      .innerJoinAndSelect('invoice.project', 'project')
      .innerJoinAndSelect('project.user', 'owner')
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
        .innerJoinAndSelect('project.user', 'owner')
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
