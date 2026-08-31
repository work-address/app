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
import { Calc } from '@/service/calc'
import AccessException from '@/exception/access-exception'

/**
 * Invoices are the money record; `Time` is the work record. Nothing else
 * stores an amount owed, and nothing else decides whether an hour has been
 * paid for - the two together are the only sources of truth.
 *
 * An invoice is issued by whoever logged the hours: a worker bills the project
 * owner for their own time, an owner bills their client for theirs. Marking it
 * paid is what flips the underlying entries to `isPaid`, so the work record
 * can never drift from the money record.
 */
@injectable()
export class InvoiceManager {
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

      found.time = times
      found.report = InvoiceManager.reportFor(
        times,
        Number(found.project?.rateHour) || 0,
      )

      return found
    })
  }

  /**
   * Rolls a set of entries up for display.
   *
   * Summed in memory from the same rows that are returned as line items, so
   * the two cannot drift. `minutes` is the wall-clock span the tracker covered
   * - it samples on a ten-minute interval, so each entry stands for ten
   * minutes - as distinct from `minutesActive`, which is time actually worked.
   */
  public static reportFor(times: Time[], rateHour: number): IInvoiceReport {
    const sum = (pick: (time: Time) => number | null | undefined): number =>
      times.reduce((total, time) => total + (Number(pick(time)) || 0), 0)

    const minutes = times.length * 10
    const minutesActive = sum((time) => time.minutesActive)

    return {
      rateHour,
      rateTotal: Calc.rateTotal(minutes, rateHour),
      minutes,
      minutesActive,
      minutesPaid: sum((time) => (time.isPaid ? time.minutesActive : 0)),
      minutesUnpaid: sum((time) => (time.isPaid ? 0 : time.minutesActive)),
      keyboardKeys: sum((time) => time.keyboardKeys),
      mouseKeys: sum((time) => time.mouseKeys),
      mouseDistance: sum((time) => time.mouseDistance),
    }
  }

  /** Hourly cost of a set of entries, in whole cents. */
  public static amountFor(times: Time[], rateHour: number): number {
    const minutes = times.reduce(
      (sum, time) => sum + (time.minutesActive || 0),
      0,
    )

    // Rounded once, at the end: rounding per entry accumulates a cent of drift
    // for every row on a long invoice.
    return Math.round((minutes / 60) * rateHour * 100)
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

      if (times.length === 0) {
        return yield* Effect.fail(
          new BadRequestError('There is no unpaid tracked time in that period'),
        )
      }

      const invoice = new Invoice()

      invoice.project = accessible
      invoice.user = author
      invoice.fromAt = fromAt
      invoice.toAt = toAt
      invoice.amountCents = InvoiceManager.amountFor(
        times,
        Number(accessible.rateHour) || 0,
      )
      invoice.state = EInvoiceState.REQUESTED
      invoice.paidAt = null

      const saved = yield* this.invoiceRepository.validateAndSave(invoice)

      yield* this.attachTime(saved, times)

      return saved
    })
  }

  /**
   * Bills a specific set of tracked entries.
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
      invoice.amountCents = InvoiceManager.amountFor(
        times,
        Number(accessible.rateHour) || 0,
      )
      invoice.state = EInvoiceState.REQUESTED
      invoice.paidAt = null

      const saved = yield* this.invoiceRepository.validateAndSave(invoice)

      yield* this.attachTime(saved, times)

      return saved
    })
  }

  private attachTime(invoice: Invoice, times: Time[]): RepoEffect<void> {
    for (const time of times) {
      time.invoice = invoice
    }

    return this.timeRepository.saveMany(times).pipe(Effect.asVoid)
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

      if (!accessible.isWorker(author)) {
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
    return Effect.gen(this, function* () {
      this.assertIssuer(invoice, actor)

      if (invoice.state === EInvoiceState.PAID) {
        return invoice
      }

      yield* this.setTimePaidFlag(invoice, true)

      invoice.state = EInvoiceState.PAID
      invoice.paidAt = new Date()

      const saved = yield* this.invoiceRepository.saveSingle(invoice)

      return saved
    })
  }

  /** Reverts a mistaken mark, releasing the entries back to unpaid. */
  public markUnpaid(invoice: Invoice, actor: User): RepoEffect<Invoice> {
    return Effect.gen(this, function* () {
      this.assertIssuer(invoice, actor)

      if (invoice.state !== EInvoiceState.PAID) {
        return invoice
      }

      yield* this.setTimePaidFlag(invoice, false)

      invoice.state = EInvoiceState.REQUESTED
      invoice.paidAt = null

      const saved = yield* this.invoiceRepository.saveSingle(invoice)

      return saved
    })
  }

  private assertIssuer(invoice: Invoice, actor: User): void {
    if (!invoice.user || invoice.user.id !== actor.id) {
      throw new AccessException(
        'Only whoever issued an invoice can change whether it is paid',
      )
    }
  }

  /**
   * Cascades the invoice's state onto the entries it bills.
   *
   * Follows the `invoice` link rather than the period: the invoice's dates are
   * only the span of what it covers, and a sparse selection leaves entries in
   * between that it must not touch.
   */
  private setTimePaidFlag(invoice: Invoice, isPaid: boolean): RepoEffect<void> {
    return Effect.gen(this, function* () {
      const times = yield* this.timeRepository.findForInvoice(invoice)

      if (times.length === 0) {
        return
      }

      for (const time of times) {
        time.isPaid = isPaid
      }

      yield* this.timeRepository.saveMany(times)
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

      if (outstanding.length === 0) {
        return yield* this.invoiceRepository.findLatestForAuthor(
          accessible,
          author,
        )
      }

      const starts = outstanding.map((time) => new Date(time.fromAt).getTime())
      const ends = outstanding.map((time) => new Date(time.toAt).getTime())

      const invoice = new Invoice()

      invoice.project = accessible
      invoice.user = author
      invoice.fromAt = new Date(Math.min(...starts))
      invoice.toAt = new Date(Math.max(...ends))
      invoice.amountCents = InvoiceManager.amountFor(
        outstanding,
        Number(accessible.rateHour) || 0,
      )
      invoice.state = EInvoiceState.REQUESTED
      invoice.paidAt = null

      const saved = yield* this.invoiceRepository.validateAndSave(invoice)

      yield* this.attachTime(saved, outstanding)

      return saved
    })
  }
}
