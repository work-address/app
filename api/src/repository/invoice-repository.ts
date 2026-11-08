import _ from 'lodash'
import { inject, injectable } from 'inversify'

import { Filter } from '@/service/filter'
import { InvoiceLines } from '@/service/invoice-lines'
import { ProjectAccess } from '@/service/project-access'
import { Brackets, In } from 'typeorm'
import { Time } from '@/entity/time'
import { AgentRunRecord } from '@/service/agent-run-record'
import { EInvoiceState, IInvoiceLine } from '@/model/invoice'
import { InvoiceSnapshot } from '@/service/invoice-snapshot'
import { AgentInvoiceLines } from '@/service/agent-invoice-lines'
import { BadRequestError } from 'routing-controllers'

import type {
  ObjectLiteral,
  OrderByCondition,
  SelectQueryBuilder,
} from 'typeorm'
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

/** What the issuer column shows: the name, or the address of someone unnamed. */
const ISSUER_LABEL_SQL = `COALESCE(NULLIF(issuer.name, ''), issuer.address)`
const ISSUER_LABEL_ALIAS = 'issuer_label'

/** Every order the invoice list can ask for, by the name it asks with. */
const INVOICE_SORT_COLUMN_BY_KEY = new Map([
  ['id', 'invoice.id'],
  ['createdAt', 'invoice.createdAt'],
  ['updatedAt', 'invoice.updatedAt'],
  ['fromAt', 'invoice.fromAt'],
  ['toAt', 'invoice.toAt'],
  ['amountCents', 'invoice.amountCents'],
  ['state', 'invoice.state'],
  ['paidAt', 'invoice.paidAt'],
  ['projectName', 'project.title'],
  ['issuedBy', ISSUER_LABEL_ALIAS],
])

/**
 * Pages are offsets, and many invoices share a project or a state: without a
 * unique tie-break a row could repeat on one page and go missing from another.
 */
const withInvoiceTieBreak = (order: OrderByCondition): OrderByCondition =>
  !Object.keys(order).length || 'invoice.id' in order
    ? order
    : { ...order, 'invoice.id': 'ASC' }

@injectable()
export class InvoiceRepository extends AbstractRepositoryTemplate<Invoice> {
  @inject('AgentRunRecord') protected runs: AgentRunRecord
  @inject('Filter')
  protected filter: Filter
  @inject('ProjectAccess')
  protected access: ProjectAccess
  protected target = Invoice

  /** Invoices are private to their issuer and the project owner. */
  private applyInvoiceAccessFilter(
    qb: SelectQueryBuilder<ObjectLiteral>,
    user: User,
  ): void {
    qb.andWhere(
      new Brackets((scope) => {
        scope
          .where('issuer.id = :accessUserId', { accessUserId: user.id })
          .orWhere('owner.id = :accessUserId', { accessUserId: user.id })
      }),
    )
  }

  /**
   * Freezes the human line and one line per agent. `agentRuns` picks the
   * issuer's finished, uninvoiced runs: none, those starting inside the
   * invoice period, or all of them (the period then grows to cover them).
   */
  public saveWithEntries(
    invoice: Invoice,
    selected: Time[],
    reuseExisting = false,
    agentRuns: 'none' | 'period' | 'all' = 'none',
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
        if (!this.access.canWork(project, invoice.user!))
          throw new AccessException()
        const times = selected.length
          ? await manager
              .getRepository(Time)
              .createQueryBuilder('time')
              .where('time.id IN (:...ids)', {
                ids: selected.map((t) => t.id),
              })
              .andWhere('time.userId=:user AND time.projectId=:project', {
                user: invoice.user!.id,
                project: project.id,
              })
              .andWhere(
                'time.invoiceId IS NULL AND COALESCE(time.isPaid,false)=false',
              )
              .orderBy('time.id')
              .setLock('pessimistic_write')
              .getMany()
          : []
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
        const runs =
          agentRuns === 'none'
            ? []
            : await this.runs.billable(
                manager,
                project,
                invoice.user!.id,
                agentRuns === 'all'
                  ? 'all'
                  : { from: invoice.fromAt, to: invoice.toAt },
              )
        if (!times.length && !runs.length) {
          // A concurrent ensure already billed everything outstanding.
          const latest = reuseExisting
            ? await manager.findOne(Invoice, {
                where: {
                  project: { id: project.id },
                  user: { id: invoice.user!.id },
                },
                order: { createdAt: 'DESC' },
              })
            : null
          if (latest) return latest
          throw new BadRequestError(
            'There is no unpaid tracked time in that period',
          )
        }
        if (agentRuns === 'all') {
          const spans = [...times, ...runs]
          invoice.fromAt = new Date(Math.min(...spans.map((s) => +s.fromAt)))
          invoice.toAt = new Date(Math.max(...spans.map((s) => +s.toAt)))
        }
        const lines: IInvoiceLine[] = []
        if (times.length) {
          lines.push(InvoiceLines.human(times, Number(project.rateHour || 0)))
        }
        if (runs.length) {
          const worker = await manager.findOneByOrFail(User, {
            id: invoice.user!.id,
          })
          // Assisted time overlaps any of the worker's own entries on the
          // project, invoiced or not.
          const human = await manager
            .createQueryBuilder(Time, 'time')
            .select(['time.id', 'time.fromAt', 'time.toAt'])
            .where('time.userId=:user AND time.projectId=:project', {
              user: worker.id,
              project: project.id,
            })
            .andWhere('time.toAt > :from AND time.fromAt < :to', {
              from: new Date(Math.min(...runs.map((r) => +r.fromAt))),
              to: new Date(Math.max(...runs.map((r) => +r.toAt))),
            })
            .getMany()
          lines.push(
            ...AgentInvoiceLines.build(
              runs,
              worker.agents ?? [],
              project.agentAttachments ?? [],
              worker.id,
              human,
              new Date(),
            ),
          )
        }
        invoice.lines = lines
        invoice.amountCents = lines.reduce(
          (sum, line) => sum + line.amountCents,
          0,
        )
        const saved = await manager.save(Invoice, invoice)
        if (times.length)
          await manager.update(
            Time,
            { id: In(times.map((t) => t.id)) },
            { invoice: saved, publishedAt: new Date() },
          )
        await this.runs.bill(manager, runs, saved.id)
        return saved
      }),
    )
  }

  /**
   * Rejects under the invoice's lock. `decide` holds the rules and marks the
   * invoice; this releases what it billed and keeps its charged basis.
   */
  public reject(
    invoice: Invoice,
    decide: (stored: Invoice, project: Project) => void,
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
        decide(stored, project)
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
        await this.runs.release(manager, stored.id)
        await manager.update(
          Time,
          { invoice: { id: stored.id } },
          { invoice: null, isPaid: false },
        )
        return manager.save(Invoice, stored)
      }),
    )
  }

  /**
   * Changes a payment under the invoice's lock. `decide` holds the rules and
   * marks the invoice; the issuer's entries and runs follow what it decided.
   */
  public setPayment(
    invoice: Invoice,
    decide: (current: Invoice) => void,
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
        const current = Object.assign(stored, locked)
        decide(current)
        const isPaid = current.state === EInvoiceState.PAID
        const scope = { user: { id: current.user!.id } }
        await this.runs.setPaid(manager, invoice.id, current.user!.id, isPaid)
        await manager.update(
          Time,
          { invoice: { id: invoice.id }, ...scope },
          { isPaid },
        )
        return manager.save(Invoice, current)
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
    const limit = this.filter.buildLimit(search)

    return fromPromise(async () =>
      this.getRepo()
        .createQueryBuilder('invoice')
        .innerJoinAndSelect('invoice.project', 'project')
        .innerJoinAndSelect('project.user', 'owner')
        .leftJoinAndSelect('invoice.user', 'issuer')
        .select()
        .addSelect(ISSUER_LABEL_SQL, ISSUER_LABEL_ALIAS)
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
        .orderBy(
          withInvoiceTieBreak(
            this.filter.buildOrderByCondition(
              INVOICE_SORT_COLUMN_BY_KEY,
              s,
              'invoices',
            ),
          ),
        )
        .skip(limit * s.page)
        .take(limit)
        .getManyAndCount(),
    )
  }
}
