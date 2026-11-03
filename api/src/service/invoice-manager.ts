import { Effect } from 'effect'
import { inject, injectable } from 'inversify'
import { BadRequestError } from 'routing-controllers'
import moment from 'moment'

import { Invoice } from '@/entity/invoice'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { RepoEffect } from '@/repository/abstract-repository-template'
import { Project } from '@/entity/project'
import { ProjectRepository } from '@/repository/project-repository'
import { Time } from '@/entity/time'
import { TimeRepository } from '@/repository/time-repository'
import { User } from '@/entity/user'
import { EInvoiceState, IInvoiceReport } from '@/model/invoice'
import { InvoiceCreateDto } from '@/model/dto/invoice'
import AccessException from '@/exception/access-exception'
import { InvoiceSnapshot } from '@/service/invoice-snapshot'
import { ProjectAccess } from '@/service/project-access'

/**
 * Invoices are the money record; `Time` is the work record. Nothing else
 * stores an amount owed - the two together are the only sources of truth.
 *
 * An invoice is issued by whoever logged the hours: a worker bills the project
 * owner for their own time, an owner bills their client for theirs. Marking it
 * paid sets its entries `isPaid`, over any hand-mark; an author may change one
 * by hand afterwards, which never changes the invoice (SPEC.md).
 */
@injectable()
export class InvoiceManager {
  @inject('ProjectAccess')
  protected access: ProjectAccess

  @inject('InvoiceRepository')
  protected invoiceRepository: InvoiceRepository
  @inject('ProjectRepository')
  protected projectRepository: ProjectRepository
  @inject('TimeRepository')
  protected timeRepository: TimeRepository

  /**
   * Everything the invoice page needs, in one read: the invoice, the entries
   * it bills, and their roll-up.
   *
   * The breakdown follows the `Time.invoice` link rather than the project, so
   * the line items are exactly what this invoice charges for. Reading the
   * project's time instead - which is what the separate report endpoint used
   * to serve here - listed hours from other invoices and uninvoiced hours
   * under a total that covered neither.
   */
  public read(invoice: Invoice, user: User): RepoEffect<Invoice> {
    return Effect.gen(this, function* () {
      const found = yield* this.invoiceRepository.findOneConfirmUser(
        invoice,
        user,
      )

      const times = yield* this.timeRepository.findForInvoiceSummary(found)

      const active = times.reduce((sum, t) => sum + (t.minutesActive || 0), 0)
      found.lines ??= [InvoiceSnapshot.legacyHuman(found.amountCents, active)]
      found.time = times
      found.report = InvoiceManager.reportFor(found, times)
      return found
    })
  }

  /**
   * The invoice page's roll-up. Money and minutes come from the frozen human
   * line, because that is what was charged; input counts come from the entries.
   */
  private static reportFor(invoice: Invoice, times: Time[]): IInvoiceReport {
    const sum = (pick: (time: Time) => number | null | undefined): number =>
      times.reduce((total, time) => total + (Number(pick(time)) || 0), 0)
    const human = invoice.lines?.find((line) => line.kind === 'human')
    const minutes = human?.minutes ?? 0

    return {
      rateHour: human
        ? human.rateHourCents === null
          ? null
          : human.rateHourCents / 100
        : 0,
      rateTotal: invoice.amountCents / 100,
      minutes,
      minutesActive: human?.activeMinutes ?? 0,
      minutesPaid: invoice.state === EInvoiceState.PAID ? minutes : 0,
      minutesUnpaid: invoice.state === EInvoiceState.REQUESTED ? minutes : 0,
      keyboardKeys: sum((time) => time.keyboardKeys),
      mouseKeys: sum((time) => time.mouseKeys),
      mouseDistance: sum((time) => time.mouseDistance),
    }
  }

  /**
   * Issues an invoice for the caller's own unpaid time in a range.
   *
   * Access is worker-or-owner, not owner-only: a contractor billing for their
   * hours is the primary case, and requiring the owner to raise it on their
   * behalf would make the owner author both sides of the transaction.
   */
  public create(
    data: InvoiceCreateDto,
    project: Project,
    author: User,
  ): RepoEffect<Invoice> {
    return Effect.gen(this, function* () {
      const accessible = yield* this.assertCanInvoice(project, author)

      // The controller routes a missing range to ensureForProject, so both
      // bounds are present by the time this runs.
      const fromAt = moment.utc(data.fromUnix).toDate()
      const toAt = moment.utc(data.toUnix).toDate()

      if (fromAt >= toAt) {
        return yield* Effect.fail(
          new BadRequestError('The invoice period ends before it starts'),
        )
      }

      const times = yield* this.timeRepository.findUnpaidTimeForAuthorBetween(
        fromAt,
        toAt,
        accessible,
        author,
      )

      // With no human time the invoice can still carry agent lines; the
      // repository refuses it when neither exists.
      const invoice = new Invoice()

      invoice.project = accessible
      invoice.user = author
      invoice.fromAt = fromAt
      invoice.toAt = toAt
      invoice.state = EInvoiceState.REQUESTED
      invoice.paidAt = null

      const saved = yield* this.invoiceRepository.saveWithEntries(
        invoice,
        times,
        false,
        'period',
      )

      return saved
    })
  }

  /**
   * Bills a specific set of tracked entries. Agent runs are not part of a
   * selection; they wait for a period invoice.
   *
   * Every id must belong to the caller, to this project, and be neither paid
   * nor already invoiced - the repository filters on all of that, so a short
   * result means at least one id failed and the whole request is refused
   * rather than quietly billing the subset that passed.
   */
  public createFromTimeIds(
    project: Project,
    author: User,
    timeIds: string[],
  ): RepoEffect<Invoice> {
    return Effect.gen(this, function* () {
      const accessible = yield* this.assertCanInvoice(project, author)

      const unique = [...new Set(timeIds)]

      if (unique.length === 0) {
        return yield* Effect.fail(
          new BadRequestError('No time entries were selected'),
        )
      }

      const times = yield* this.timeRepository.findInvoiceableByIds(
        unique,
        accessible,
        author,
      )

      if (times.length !== unique.length) {
        return yield* Effect.fail(
          new BadRequestError(
            'Some of the selected entries are not yours, already paid, or already on an invoice',
          ),
        )
      }

      const invoice = new Invoice()

      invoice.project = accessible
      invoice.user = author
      // The period spans the selection. It is descriptive only - what the
      // invoice bills is the linked entries, so a sparse selection does not
      // claim the days between them.
      invoice.fromAt = new Date(
        Math.min(...times.map((time) => new Date(time.fromAt).getTime())),
      )
      invoice.toAt = new Date(
        Math.max(...times.map((time) => new Date(time.toAt).getTime())),
      )
      invoice.state = EInvoiceState.REQUESTED
      invoice.paidAt = null

      const saved = yield* this.invoiceRepository.saveWithEntries(
        invoice,
        times,
      )

      return saved
    })
  }

  /**
   * Who may raise an invoice against a project: its owner, or a worker on it.
   *
   * Shared by `create` and `ensureForProject` so there is one rule rather than
   * two that can drift - the second would inevitably be the lenient one.
   */
  private assertCanInvoice(
    project: Project,
    author: User,
  ): RepoEffect<Project> {
    return Effect.gen(this, function* () {
      const accessible = yield* this.projectRepository.findProjectWithAccess(
        project,
        author,
      )

      if (!accessible) {
        return yield* Effect.fail(
          new AccessException('The project is not one you own or work on'),
        )
      }

      if (!this.access.canWork(accessible, author)) {
        return yield* Effect.fail(
          new AccessException(
            'Only a worker or the owner of a project can invoice for its time',
          ),
        )
      }

      return accessible
    })
  }

  /**
   * Records that the invoice was settled, and marks the hours behind it paid.
   *
   * Only the issuer may do this. The person owed the money is the one who
   * knows whether it arrived, and letting the payer self-certify would make
   * the record worth less than the wallet history it is meant to summarise.
   */
  public markPaid(invoice: Invoice, actor: User): RepoEffect<Invoice> {
    return this.setPaid(invoice, actor, true)
  }
  public markUnpaid(invoice: Invoice, actor: User): RepoEffect<Invoice> {
    return this.setPaid(invoice, actor, false)
  }

  private setPaid(
    invoice: Invoice,
    actor: User,
    paid: boolean,
  ): RepoEffect<Invoice> {
    return this.invoiceRepository.setPayment(invoice, (current) => {
      if (current.user?.id !== actor.id) {
        throw new AccessException(
          'Only the person who issued an invoice may change its payment state',
        )
      }

      if (current.state === EInvoiceState.REJECTED) {
        throw new BadRequestError('A rejected invoice cannot be paid')
      }

      current.state = paid ? EInvoiceState.PAID : EInvoiceState.REQUESTED
      current.paidAt = paid ? (current.paidAt ?? new Date()) : null
    })
  }

  /** The person paying is the one who disputes, and only the invoice as a whole. */
  public reject(
    invoice: Invoice,
    actor: User,
    reason?: string,
  ): RepoEffect<Invoice> {
    return this.invoiceRepository.reject(invoice, (stored, project) => {
      if (!project.isOwner(actor)) {
        throw new AccessException(
          'Only the project owner may reject an invoice',
        )
      }

      if (stored.state !== EInvoiceState.REQUESTED) {
        throw new BadRequestError('Only a requested invoice can be rejected')
      }

      if (
        reason !== undefined &&
        (typeof reason !== 'string' || reason.length > 500)
      ) {
        throw new BadRequestError('Invalid rejection reason')
      }

      stored.state = EInvoiceState.REJECTED
      stored.rejectionReason = reason?.trim() || null
      stored.rejectedAt = new Date()
    })
  }

  /**
   * Returns an invoice covering every hour the caller has not yet invoiced on
   * this project, creating one if any are outstanding.
   *
   * Idempotent by construction: outstanding time is *unpaid and not already
   * covered by one of the caller's invoices*, so a second call finds nothing
   * left and raises nothing. Existing invoices are never touched or merged -
   * each one stays the frozen record of the period it was raised for.
   *
   * The period spans the outstanding entries themselves rather than "now minus
   * a month", so an invoice covers exactly what it bills for and the overlap
   * check above stays exact.
   */
  public ensureForProject(
    project: Project,
    author: User,
  ): RepoEffect<Invoice | null> {
    return Effect.gen(this, function* () {
      const accessible = yield* this.assertCanInvoice(project, author)

      const outstanding =
        yield* this.timeRepository.findUninvoicedUnpaidTimeForAuthor(
          accessible,
          author,
        )

      if (
        outstanding.length === 0 &&
        !(yield* this.invoiceRepository.hasInvoiceableAgentRuns(
          accessible,
          author,
        ))
      ) {
        return yield* this.invoiceRepository.findLatestForAuthor(
          accessible,
          author,
        )
      }

      const invoice = new Invoice()

      invoice.project = accessible
      invoice.user = author
      // The repository sets the period to span the human entries and agent
      // runs it bills.
      invoice.state = EInvoiceState.REQUESTED
      invoice.paidAt = null

      const saved = yield* this.invoiceRepository.saveWithEntries(
        invoice,
        outstanding,
        true,
        'all',
      )

      return saved
    })
  }
}
