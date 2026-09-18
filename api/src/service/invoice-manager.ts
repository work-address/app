import { Effect } from 'effect'
import { inject, injectable } from 'inversify'
import { BadRequestError } from 'routing-controllers'
import moment from 'moment'
import { EntityManager } from 'typeorm'

import { Invoice } from '@/entity/invoice'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { RepoEffect } from '@/repository/abstract-repository-template'
import { Project } from '@/entity/project'
import { ProjectRepository } from '@/repository/project-repository'
import { Time } from '@/entity/time'
import { TimeRepository } from '@/repository/time-repository'
import { User } from '@/entity/user'
import {
  EInvoiceCurrency,
  EInvoiceSnapshotVersion,
  EInvoiceState,
  IInvoiceLine,
  IInvoiceRecord,
  IInvoiceReport,
} from '@/model/invoice'
import { InvoiceCreateDto } from '@/model/dto/invoice'
import { Calc } from '@/service/calc'
import { InvoiceRecord } from '@/service/invoice-record'
import { WalletAddress } from '@/service/wallet-address'
import { UnitOfWork } from '@/service/unit-of-work'
import AccessException from '@/exception/access-exception'
import InvoicedTimeException from '@/exception/invoiced-time-exception'
import LegacyInvoiceException from '@/exception/legacy-invoice-exception'

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
  @inject('UnitOfWork')
  protected unitOfWork: UnitOfWork
  @inject('InvoiceRecord')
  protected invoiceRecord: InvoiceRecord

  /**
   * Everything the invoice page needs, in one read: the invoice, the entries
   * it bills, and their roll-up.
   *
   * The breakdown follows the `Time.invoice` link rather than the project, so
   * the line items are exactly what this invoice charges for. Reading the
   * project's time instead - which is what the separate report endpoint used
   * to serve here - listed hours from other invoices and uninvoiced hours
   * under a total that covered neither.
   *
   * The money side of the roll-up comes from the invoice's own snapshot, not
   * from the project: an owner who changes the rate after the invoice was
   * issued changes nothing on it (DEC-04).
   */
  public read(invoice: Invoice, user: User): RepoEffect<Invoice> {
    return Effect.gen(this, function* () {
      const found = yield* this.invoiceRepository.findOneConfirmUser(
        invoice,
        user,
      )

      const times = yield* this.timeRepository.findForInvoiceSummary(found)

      found.time = times
      found.report = InvoiceManager.reportFor(found, times)

      return found
    })
  }

  /**
   * The invoice's InvoiceRecord v1: the canonical document an escrow invoice
   * commitment hashes (see InvoiceCommitment), for whoever may read the
   * invoice - the issuer, who commits to it, and the project owner, who
   * checks the opening.
   *
   * Built from the snapshot alone, so it is the same document on every read.
   * A legacy invoice has no snapshot and is refused with a 409 rather than
   * given a record assembled from today's project.
   */
  public record(invoice: Invoice, user: User): RepoEffect<IInvoiceRecord> {
    return Effect.gen(this, function* () {
      const found = yield* this.invoiceRepository.findOneConfirmUser(
        invoice,
        user,
      )

      if (found.snapshotVersion !== InvoiceRecord.VERSION) {
        return yield* Effect.fail(
          new LegacyInvoiceException(
            `Invoice ${found.id} was issued before invoices kept their rate and lines, so it has no InvoiceRecord`,
          ),
        )
      }

      return this.invoiceRecord.document(found)
    })
  }

  /**
   * Rolls an invoice up for display.
   *
   * With a snapshot, the minutes, the rate and what is paid come from what the
   * invoice froze at issuance - its lines, its rate, its state - so the
   * summary and the amount beneath it cannot drift apart. The activity
   * counters are summed from the linked entries: they are monitoring
   * evidence, not billing, and clearing or re-syncing them is allowed.
   *
   * A legacy invoice never recorded its rate, so it reports none rather than
   * borrowing today's project rate; its minutes are summed from the linked
   * entries as before.
   *
   * `minutes` is the wall-clock span covered, read from each line's own
   * fromAt/toAt rather than assumed from a fixed interval. Distinct from
   * `minutesActive`, which is time actually worked.
   */
  public static reportFor(invoice: Invoice, times: Time[]): IInvoiceReport {
    const sum = (pick: (time: Time) => number | null | undefined): number =>
      times.reduce((total, time) => total + (Number(pick(time)) || 0), 0)

    const activity = {
      keyboardKeys: sum((time) => time.keyboardKeys),
      mouseKeys: sum((time) => time.mouseKeys),
      mouseDistance: sum((time) => time.mouseDistance),
    }

    if (
      invoice.snapshotVersion === EInvoiceSnapshotVersion.V1 &&
      invoice.lines
    ) {
      const minutes = Calc.spanMinutes(
        invoice.lines.map((line) => ({
          fromAt: new Date(line.fromAt),
          toAt: new Date(line.toAt),
        })),
      )
      const minutesActive = Number(invoice.minutesActive) || 0
      const rateHour = (Number(invoice.rateHourCents) || 0) / 100
      const isPaid = invoice.state === EInvoiceState.PAID

      return {
        rateHour,
        rateTotal: Calc.rateTotal(minutes, rateHour),
        minutes,
        minutesActive,
        // Payment is the invoice's, and covers every line at once.
        minutesPaid: isPaid ? minutesActive : 0,
        minutesUnpaid: isPaid ? 0 : minutesActive,
        ...activity,
      }
    }

    return {
      rateHour: null,
      rateTotal: null,
      minutes: Calc.spanMinutes(times),
      minutesActive: sum((time) => time.minutesActive),
      minutesPaid: sum((time) => (time.isPaid ? time.minutesActive : 0)),
      minutesUnpaid: sum((time) => (time.isPaid ? 0 : time.minutesActive)),
      ...activity,
    }
  }

  /** Hourly cost of a set of entries, in whole cents. */
  public static amountFor(times: Time[], rateHour: number): number {
    // Rounded once, at the end: rounding per entry accumulates a cent of drift
    // for every row on a long invoice.
    return Calc.amountCents(
      InvoiceManager.minutesActiveOf(times),
      Calc.rateHourCents(rateHour),
    )
  }

  /**
   * The lines an invoice freezes: each billed entry's span and active
   * minutes, in record order (start, then id).
   */
  public static linesFor(times: Time[]): IInvoiceLine[] {
    return InvoiceRecord.ordered(
      times.map((time) => ({
        timeId: time.id,
        fromAt: InvoiceRecord.timestamp(time.fromAt),
        toAt: InvoiceRecord.timestamp(time.toAt),
        minutesActive: Number(time.minutesActive) || 0,
      })),
    )
  }

  private static minutesActiveOf(times: Time[]): number {
    return times.reduce(
      (sum, time) => sum + (Number(time.minutesActive) || 0),
      0,
    )
  }

  /**
   * Issues an invoice for the caller's own unpaid, uninvoiced time in a range.
   *
   * Access is worker-or-owner, not owner-only: a contractor billing for their
   * hours is the primary case, and requiring the owner to raise it on their
   * behalf would make the owner author both sides of the transaction.
   *
   * Entries in the range that another invoice already bills are left where
   * they are; only the rest are billed, and a range with nothing else in it
   * is refused.
   */
  public create(
    data: InvoiceCreateDto,
    project: Project,
    author: User,
  ): RepoEffect<Invoice> {
    return Effect.gen(this, function* () {
      const accessible = yield* this.assertCanInvoice(project, author)

      // The DTO refuses a lone bound over HTTP; this covers every other caller
      // (a scheduler, say), for which "no end" must not quietly mean "now".
      if (data.fromUnix === undefined || data.toUnix === undefined) {
        return yield* Effect.fail(
          new BadRequestError(
            'An invoice period needs both a start and an end',
          ),
        )
      }

      const fromAt = moment.utc(data.fromUnix).toDate()
      const toAt = moment.utc(data.toUnix).toDate()

      if (fromAt >= toAt) {
        return yield* Effect.fail(
          new BadRequestError('The invoice period ends before it starts'),
        )
      }

      return yield* this.unitOfWork.run((manager) =>
        Effect.gen(this, function* () {
          const times = yield* this.timeRepository
            .within(manager)
            .findUnpaidTimeForAuthorBetween(fromAt, toAt, accessible, author, {
              forUpdate: true,
            })

          if (times.length === 0) {
            return yield* Effect.fail(
              new BadRequestError(
                'There is no unpaid tracked time in that period that is not already on an invoice',
              ),
            )
          }

          return yield* this.issue(manager, accessible, author, times, {
            fromAt,
            toAt,
          })
        }),
      )
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

      return yield* this.unitOfWork.run((manager) =>
        Effect.gen(this, function* () {
          const times = yield* this.timeRepository
            .within(manager)
            .findInvoiceableByIds(unique, accessible, author, {
              forUpdate: true,
            })

          if (times.length !== unique.length) {
            return yield* Effect.fail(
              new BadRequestError(
                'Some of the selected entries are not yours, already paid, or already on an invoice',
              ),
            )
          }

          // The period spans the selection. It is descriptive only - what the
          // invoice bills is the linked entries, so a sparse selection does
          // not claim the days between them.
          return yield* this.issue(
            manager,
            accessible,
            author,
            times,
            InvoiceManager.spanOf(times),
          )
        }),
      )
    })
  }

  /**
   * Saves the invoice with its financial snapshot and links the entries it
   * bills, inside the caller's transaction.
   *
   * The snapshot - rate, currency, both addresses, active minutes and the
   * lines - is written in the same insert as `amountCents`, and the amount is
   * computed from it, so the stored record always explains its own total and
   * later edits to the project or the entries change neither (DEC-04).
   *
   * Every caller has already read `times` with a row lock, so no concurrent
   * issuance can have claimed them since; the claim re-checks that on the
   * write anyway, and a short count rolls the whole invoice back rather than
   * leaving one whose amount covers lines it does not have.
   */
  private issue(
    manager: EntityManager,
    project: Project,
    author: User,
    times: Time[],
    period: { fromAt: Date; toAt: Date },
  ): RepoEffect<Invoice> {
    return Effect.gen(this, function* () {
      const invoice = new Invoice()
      const lines = InvoiceManager.linesFor(times)
      const minutesActive = lines.reduce(
        (sum, line) => sum + line.minutesActive,
        0,
      )
      const rateHourCents = Calc.rateHourCents(project.rateHour)

      invoice.project = project
      invoice.user = author
      invoice.fromAt = period.fromAt
      invoice.toAt = period.toAt
      invoice.snapshotVersion = EInvoiceSnapshotVersion.V1
      invoice.issuerAddress = WalletAddress.toCanonical(author.address)
      invoice.ownerAddress = WalletAddress.toCanonical(project.user.address)
      invoice.currency = EInvoiceCurrency.USD
      invoice.rateHourCents = rateHourCents
      invoice.minutesActive = minutesActive
      invoice.lines = lines
      invoice.amountCents = Calc.amountCents(minutesActive, rateHourCents)
      invoice.state = EInvoiceState.REQUESTED
      invoice.paidAt = null

      const saved = yield* this.invoiceRepository
        .within(manager)
        .validateAndSave(invoice)

      const claimed = yield* this.timeRepository
        .within(manager)
        .claimForInvoice(saved, times)

      if (claimed !== times.length) {
        return yield* Effect.fail(
          new InvoicedTimeException(
            'Another invoice claimed some of these entries first; nothing was billed',
          ),
        )
      }

      return saved
    })
  }

  /** The span a set of entries covers, from the first start to the last end. */
  private static spanOf(times: Time[]): { fromAt: Date; toAt: Date } {
    const starts = times.map((time) => new Date(time.fromAt).getTime())
    const ends = times.map((time) => new Date(time.toAt).getTime())

    return {
      fromAt: new Date(Math.min(...starts)),
      toAt: new Date(Math.max(...ends)),
    }
  }

  /**
   * Who may raise an invoice against a project: its owner, or a worker on it.
   *
   * Shared by `create` and `ensureForProject` so there is one rule rather than
   * two that can drift - the second would inevitably be the lenient one.
   *
   * Role alone decides it, never the owner's plan. The role check used to
   * fall back to the owner's stored premium flag, which nothing sets on a
   * self-hosted instance, so there a worker could open the project and then
   * be refused an invoice for their own hours.
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
    return this.setPaid(invoice, actor, true)
  }

  /** Reverts a mistaken mark, releasing the entries back to unpaid. */
  public markUnpaid(invoice: Invoice, actor: User): RepoEffect<Invoice> {
    return this.setPaid(invoice, actor, false)
  }

  /**
   * The invoice's state and its entries' `isPaid` change together or not at
   * all.
   *
   * One transaction, with the invoice row locked first: the state is read
   * from the locked row rather than from the copy the request loaded, so a
   * concurrent mark waits and then sees this one's result, and a failure
   * saving the invoice takes the cascade back with it.
   */
  private setPaid(
    invoice: Invoice,
    actor: User,
    isPaid: boolean,
  ): RepoEffect<Invoice> {
    return Effect.gen(this, function* () {
      this.assertIssuer(invoice, actor)

      return yield* this.unitOfWork.run((manager) =>
        Effect.gen(this, function* () {
          const current = yield* this.invoiceRepository
            .within(manager)
            .findOneForUpdate(invoice)

          invoice.state = current.state
          invoice.paidAt = current.paidAt

          if ((invoice.state === EInvoiceState.PAID) === isPaid) {
            return invoice
          }

          yield* this.timeRepository
            .within(manager)
            .setPaidForInvoice(invoice, isPaid)

          invoice.state = isPaid ? EInvoiceState.PAID : EInvoiceState.REQUESTED
          invoice.paidAt = isPaid ? new Date() : null

          return yield* this.invoiceRepository
            .within(manager)
            .saveSingle(invoice)
        }),
      )
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

      // One transaction, with the outstanding rows locked: a double click
      // sends two of these at once, and the second waits for the first, then
      // finds nothing outstanding and returns the invoice the first raised.
      return yield* this.unitOfWork.run((manager) =>
        Effect.gen(this, function* () {
          const outstanding = yield* this.timeRepository
            .within(manager)
            .findUninvoicedUnpaidTimeForAuthor(accessible, author, {
              forUpdate: true,
            })

          if (outstanding.length === 0) {
            return yield* this.invoiceRepository
              .within(manager)
              .findLatestForAuthor(accessible, author)
          }

          return yield* this.issue(
            manager,
            accessible,
            author,
            outstanding,
            InvoiceManager.spanOf(outstanding),
          )
        }),
      )
    })
  }
}
