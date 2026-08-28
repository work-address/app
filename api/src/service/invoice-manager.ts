import { inject, injectable } from 'inversify'
import { BadRequestError } from 'routing-controllers'
import moment from 'moment'

import { Invoice } from '@/entity/invoice'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { Project } from '@/entity/project'
import { ProjectRepository } from '@/repository/project-repository'
import { Time } from '@/entity/time'
import { TimeRepository } from '@/repository/time-repository'
import { RedisClient } from '@/service/redis-client'
import { User } from '@/entity/user'
import { EInvoiceState } from '@/model/invoice'
import { InvoiceCreateDto } from '@/model/dto/invoice'
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
  @inject('RedisClient')
  protected redisClient: RedisClient

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
  public async create(
    data: InvoiceCreateDto,
    project: Project,
    author: User,
  ): Promise<Invoice> {
    const accessible = await this.assertCanInvoice(project, author)

    // The controller routes a missing range to ensureForProject, so both
    // bounds are present by the time this runs.
    const fromAt = moment.utc(data.fromUnix).toDate()
    const toAt = moment.utc(data.toUnix).toDate()

    if (fromAt >= toAt) {
      throw new BadRequestError('The invoice period ends before it starts')
    }

    const times = await this.timeRepository.findUnpaidTimeForAuthorBetween(
      fromAt,
      toAt,
      accessible,
      author,
    )

    if (times.length === 0) {
      throw new BadRequestError(
        'There is no unpaid tracked time in that period',
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

    const saved = await this.invoiceRepository.validateAndSave(invoice)
    await this.invalidateReport(accessible)

    return saved
  }

  /**
   * Who may raise an invoice against a project: its owner, or a worker on it.
   *
   * Shared by `create` and `ensureForProject` so there is one rule rather than
   * two that can drift - the second would inevitably be the lenient one.
   */
  private async assertCanInvoice(
    project: Project,
    author: User,
  ): Promise<Project> {
    const accessible = await this.projectRepository.findProjectWithAccess(
      project,
      author,
    )

    if (!accessible) {
      throw new AccessException('The project is not one you own or work on')
    }

    if (!accessible.isWorker(author)) {
      throw new AccessException(
        'Only a worker or the owner of a project can invoice for its time',
      )
    }

    return accessible
  }

  /**
   * Records that the invoice was settled, and marks the hours behind it paid.
   *
   * Only the issuer may do this. The person owed the money is the one who
   * knows whether it arrived, and letting the payer self-certify would make
   * the record worth less than the wallet history it is meant to summarise.
   */
  public async markPaid(invoice: Invoice, actor: User): Promise<Invoice> {
    this.assertIssuer(invoice, actor)

    if (invoice.state === EInvoiceState.PAID) {
      return invoice
    }

    await this.setTimePaidFlag(invoice, true)

    invoice.state = EInvoiceState.PAID
    invoice.paidAt = new Date()

    const saved = await this.invoiceRepository.saveSingle(invoice)
    await this.invalidateReport(invoice.project)

    return saved
  }

  /** Reverts a mistaken mark, releasing the entries back to unpaid. */
  public async markUnpaid(invoice: Invoice, actor: User): Promise<Invoice> {
    this.assertIssuer(invoice, actor)

    if (invoice.state !== EInvoiceState.PAID) {
      return invoice
    }

    await this.setTimePaidFlag(invoice, false)

    invoice.state = EInvoiceState.REQUESTED
    invoice.paidAt = null

    const saved = await this.invoiceRepository.saveSingle(invoice)
    await this.invalidateReport(invoice.project)

    return saved
  }

  private assertIssuer(invoice: Invoice, actor: User): void {
    if (!invoice.user || invoice.user.id !== actor.id) {
      throw new AccessException(
        'Only whoever issued an invoice can change whether it is paid',
      )
    }
  }

  /**
   * Cascades the invoice's state onto the entries it covers.
   *
   * Scoped to the issuer's own entries in the period, so an invoice for one
   * worker never marks a colleague's hours on the same project and dates.
   */
  private async setTimePaidFlag(
    invoice: Invoice,
    isPaid: boolean,
  ): Promise<void> {
    if (!invoice.user) {
      return
    }

    const times = await this.timeRepository.findTimeForAuthorBetween(
      invoice.fromAt,
      invoice.toAt,
      invoice.project,
      invoice.user,
    )

    if (times.length === 0) {
      return
    }

    for (const time of times) {
      time.isPaid = isPaid
    }

    await this.timeRepository.saveMany(times)
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
  public async ensureForProject(
    project: Project,
    author: User,
  ): Promise<Invoice | null> {
    const accessible = await this.assertCanInvoice(project, author)

    const outstanding =
      await this.timeRepository.findUninvoicedUnpaidTimeForAuthor(
        accessible,
        author,
      )

    if (outstanding.length === 0) {
      return this.invoiceRepository.findLatestForAuthor(accessible, author)
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

    const saved = await this.invoiceRepository.validateAndSave(invoice)
    await this.invalidateReport(accessible)

    return saved
  }

  /**
   * The cached time report is keyed on the project and lives for ten minutes,
   * and nothing else clears it. Without this, settling an invoice leaves the
   * project still showing those hours as owed until the cache expires.
   */
  private async invalidateReport(project: Project): Promise<void> {
    try {
      await this.redisClient.del(project.id)
    } catch (error) {
      // A stale report is a display problem for a few minutes; a failed cache
      // delete must not roll back a payment that already happened.
      console.error(
        `InvoiceManager: failed to invalidate report cache for project ${project.id}`,
        error,
      )
    }
  }
}
