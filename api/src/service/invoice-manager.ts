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
  EInvoiceBasis,
  EInvoiceCurrency,
  EInvoiceEscrowState,
  EInvoiceIssuanceKind,
  EInvoiceSettlementKind,
  EInvoiceSnapshotVersion,
  EInvoiceState,
  IInvoiceEscrowSettlement,
  IInvoiceEscrowSettlementResult,
  IInvoiceEscrowSubmission,
  IInvoiceEscrowSubmissionRequest,
  IInvoiceLine,
  IInvoiceMilestoneBill,
  IInvoiceMilestoneResult,
  IInvoiceRecord,
  IInvoiceReport,
} from '@/model/invoice'
import { InvoiceCreateDto } from '@/model/dto/invoice'
import { IInvoiceCadencePeriod } from '@/model/project'
import { Calc } from '@/service/calc'
import { InvoiceCommitment } from '@/service/invoice-commitment'
import { InvoiceEscrow } from '@/service/invoice-escrow'
import { InvoiceRecord } from '@/service/invoice-record'
import { WalletAddress } from '@/service/wallet-address'
import { UnitOfWork } from '@/service/unit-of-work'
import AccessException from '@/exception/access-exception'
import InvoiceAdjustmentException from '@/exception/invoice-adjustment-exception'
import InvoiceEscrowException from '@/exception/invoice-escrow-exception'
import InvoicedTimeException from '@/exception/invoiced-time-exception'
import LegacyInvoiceException from '@/exception/legacy-invoice-exception'

/**
 * What one scheduled period came to.
 *
 * `created` separates "this call raised it" from "it was already there",
 * which a bare invoice cannot: both are successes, and only the first is an
 * event. A period with nothing to bill has no invoice at all.
 */
export interface IInvoiceIssueOutcome {
  invoice: Invoice | null
  created: boolean
}

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
  @inject('InvoiceCommitment')
  protected invoiceCommitment: InvoiceCommitment

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
   * What the issuer submits to MarketplaceEscrow for this invoice and
   * allocation: the amount in token base units and the InvoiceCommitment v1,
   * with the salt it was drawn under.
   *
   * The first call binds the invoice to the allocation: it draws a fresh
   * salt, commits to the invoice's record for that allocation, and stores
   * all of it on the invoice. Every later call for the same allocation
   * returns exactly that - the same salt and commitment - so asking twice
   * never produces a second commitment the chain could be handed. A call for
   * any other allocation is refused (409): the chain cannot tell this
   * service whether the first commitment was ever sent, so moving the
   * invoice could bill it twice. An allocation already billing another
   * invoice is refused too - it takes one bill.
   *
   * Only an allocation that funds this invoice's own contract binds it. The
   * marketplace derives every allocation id from its contract and work
   * period, so the id is recomputed here from the project's
   * `marketplaceContractId` and the period the request names, and anything
   * else is refused (409) - as is an invoice whose period lies outside that
   * work period, or one on a project no marketplace contract hired for. An
   * allocation id is public once funded, and a binding never moves, so
   * without this anyone able to issue an invoice anywhere could bind the
   * allocation first and leave the hired worker's invoice unbillable.
   *
   * Issuer only, and the issuer must be the worker hired on the project
   * (403 otherwise): the owner is the payer, even on an invoice of their
   * own, and nobody else can read the invoice. A legacy invoice has no
   * record to commit to (409), and a paid one or one for nothing has
   * nothing to bill (409).
   */
  public escrowSubmission(
    invoice: Invoice,
    actor: User,
    request: IInvoiceEscrowSubmissionRequest,
  ): RepoEffect<IInvoiceEscrowSubmission> {
    return Effect.gen(this, function* () {
      const found = yield* this.invoiceRepository.findOneConfirmUser(
        invoice,
        actor,
      )

      if (!found.user || found.user.id !== actor.id) {
        return yield* Effect.fail(
          new AccessException(
            'Only whoever issued an invoice can submit it to escrow',
          ),
        )
      }

      if (found.snapshotVersion !== InvoiceRecord.VERSION) {
        return yield* Effect.fail(
          new LegacyInvoiceException(
            `Invoice ${found.id} was issued before invoices kept their rate and lines, so it has no record to commit to`,
          ),
        )
      }

      const contractId = found.project?.marketplaceContractId

      if (!contractId) {
        return yield* Effect.fail(
          new InvoiceEscrowException(
            `Invoice ${found.id} is on a project no marketplace contract hired for, so no escrow allocation funds it`,
          ),
        )
      }

      const project = yield* this.projectRepository.findProjectWithAccess(
        found.project,
        actor,
      )

      // isWorker counts the owner too; the owner is the payer.
      if (!project || project.isOwner(actor) || !project.isWorker(actor)) {
        return yield* Effect.fail(
          new AccessException(
            'Only the worker hired on a marketplace contract can submit its invoices to escrow',
          ),
        )
      }

      if (request.workEnd <= request.workStart) {
        return yield* Effect.fail(
          new BadRequestError('The work period ends before it starts'),
        )
      }

      const target = InvoiceEscrow.binding(request)

      if (
        InvoiceEscrow.contractPeriodAllocationId(contractId, request) !==
        target.allocationId
      ) {
        return yield* Effect.fail(
          new InvoiceEscrowException(
            `Allocation ${target.allocationId} does not fund contract ${contractId}'s work from ${request.workStart} to ${request.workEnd} on escrow ${target.escrow}`,
          ),
        )
      }

      if (!InvoiceEscrow.withinPeriod(found, request)) {
        return yield* Effect.fail(
          new InvoiceEscrowException(
            `Invoice ${found.id} bills time outside the work period ${request.workStart} to ${request.workEnd} that allocation ${target.allocationId} funds`,
          ),
        )
      }

      const record = this.invoiceRecord.document(found)

      return yield* this.unitOfWork.run((manager) =>
        Effect.gen(this, function* () {
          const current = yield* this.invoiceRepository
            .within(manager)
            .findOneForUpdate(found)

          if (InvoiceEscrow.isBound(current)) {
            if (!InvoiceEscrow.isBoundTo(current, target)) {
              return yield* Effect.fail(
                new InvoiceEscrowException(
                  `Invoice ${current.id} is already submitted to allocation ${current.escrowAllocationId}`,
                ),
              )
            }

            return InvoiceEscrow.submission(current)
          }

          if (current.state === EInvoiceState.PAID) {
            return yield* Effect.fail(
              new InvoiceEscrowException(
                `Invoice ${current.id} is already paid, so there is nothing to bill through escrow`,
              ),
            )
          }

          // MarketplaceEscrow refuses a bill of 0; better said here than by
          // a reverted transaction the worker paid gas for.
          if (current.amountCents <= 0) {
            return yield* Effect.fail(
              new InvoiceEscrowException(
                `Invoice ${current.id} bills nothing, so there is nothing to submit to escrow`,
              ),
            )
          }

          const holder = yield* this.invoiceRepository
            .within(manager)
            .findByEscrowAllocation(target)

          if (holder) {
            return yield* Effect.fail(
              new InvoiceEscrowException(
                `Allocation ${target.allocationId} already bills another invoice`,
              ),
            )
          }

          const salt = InvoiceEscrow.drawSalt()
          const commitment = this.invoiceCommitment.commit(record, target, salt)

          yield* this.invoiceRepository
            .within(manager)
            .bindEscrow(current, target, commitment, salt)

          current.escrowChainId = target.chainId
          current.escrowAddress = target.escrow
          current.escrowAllocationId = target.allocationId
          current.escrowCommitment = commitment
          current.escrowSalt = salt

          return InvoiceEscrow.submission(current)
        }),
      )
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

    // A fixed invoice bills an agreed sum, not hours: it has no rate and no
    // lines, so there is nothing to divide and nothing to total. Reported as
    // the zeroes and nulls it is, ahead of the snapshot branch below, whose
    // arithmetic would otherwise read a rate of zero as a rate.
    if (invoice.basis === EInvoiceBasis.FIXED) {
      return {
        rateHour: null,
        rateTotal: null,
        minutes: 0,
        minutesActive: 0,
        minutesPaid: 0,
        minutesUnpaid: 0,
        ...activity,
      }
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
   * Issues an adjustment to an invoice: a new invoice that corrects it by
   * billing what it did not (DEC-04).
   *
   * An issued invoice is never edited - its snapshot is what was billed, and
   * an entry it bills cannot be deleted. So a correction is a separate
   * invoice naming the one it corrects (`correctsInvoiceId`), issued exactly
   * like any other: the same snapshot, the same lock-and-claim, so it bills
   * only entries no invoice covers and nobody has marked paid - the late
   * sync after the invoice was raised, the last afternoon before a contract
   * ended, the hours logged after a refund. With `timeIds` it bills exactly
   * those, each of which must be such an entry (400 otherwise), as a
   * selection does.
   *
   * The original is never written to. Whatever it was - paid, refunded,
   * bound to an allocation - it stays that, and its entries stay its own.
   * Nor can the adjustment take the original's allocation: an allocation
   * takes one bill, and once it has settled, the escrow will not take
   * another (the escrow submission refuses it with a 409).
   *
   * Only an hourly invoice can be corrected this way (409 for a FIXED one):
   * a fixed-price invoice has no hours on it to have missed.
   *
   * Only the original's issuer may correct it (403): an invoice covers one
   * person's hours, and the correction is the same person's bill. They must
   * still be able to invoice the project; a project a contract's end has
   * closed still takes invoices for time tracked before it closed.
   */
  public adjust(
    invoice: Invoice,
    actor: User,
    timeIds?: string[],
  ): RepoEffect<Invoice> {
    return Effect.gen(this, function* () {
      const original = yield* this.invoiceRepository.findOneConfirmUser(
        invoice,
        actor,
      )

      if (!original.user || original.user.id !== actor.id) {
        return yield* Effect.fail(
          new AccessException(
            'Only whoever issued an invoice can issue an adjustment to it',
          ),
        )
      }

      // An invoice bills hours or an agreed sum, never both. A FIXED one has
      // no hours on it, so there are none it could have missed: an hourly
      // bill naming it would pass tracked time off as a correction to a sum
      // the parties agreed. Another sum is another milestone, and only the
      // marketplace's signed call raises those.
      if (original.basis === EInvoiceBasis.FIXED) {
        return yield* Effect.fail(
          new InvoiceAdjustmentException(
            'A fixed-price invoice bills an agreed sum, not hours, so hours cannot correct it; a different sum is agreed in the marketplace',
          ),
        )
      }

      const accessible = yield* this.assertCanInvoice(original.project, actor)
      const selection = timeIds ? [...new Set(timeIds)] : undefined

      if (selection && selection.length === 0) {
        return yield* Effect.fail(
          new BadRequestError('No time entries were selected'),
        )
      }

      return yield* this.unitOfWork.run((manager) =>
        Effect.gen(this, function* () {
          const times = selection
            ? yield* this.timeRepository
                .within(manager)
                .findInvoiceableByIds(selection, accessible, actor, {
                  forUpdate: true,
                })
            : yield* this.timeRepository
                .within(manager)
                .findUninvoicedUnpaidTimeForAuthor(accessible, actor, {
                  forUpdate: true,
                })

          if (selection && times.length !== selection.length) {
            return yield* Effect.fail(
              new BadRequestError(
                'Some of the selected entries are not yours, already paid, or already on an invoice',
              ),
            )
          }

          if (times.length === 0) {
            return yield* Effect.fail(
              new BadRequestError(
                'There is nothing left to bill: every entry of yours on this project is already on an invoice or paid',
              ),
            )
          }

          return yield* this.issue(
            manager,
            accessible,
            actor,
            times,
            InvoiceManager.spanOf(times),
            undefined,
            original.id,
          )
        }),
      )
    })
  }

  /**
   * Bills an agreed milestone: a FIXED invoice for a sum, with no tracked
   * entries behind it (MS-03).
   *
   * The alternative was to fabricate Time rows summing to the agreed price.
   * That would have put hours nobody worked into the work record, and
   * `Time` is the only record of work (SPEC.md) - so a fixed bill carries no
   * lines, no rate and no minutes, and says in `description` what it is for.
   * Every other snapshot rule is unchanged (DEC-04): the addresses, the
   * currency and the amount are frozen in the insert and never updated, so
   * the invoice explains its own total.
   *
   * Idempotent on `milestoneRef`: the reference is looked up inside the
   * transaction and the invoice the first push raised is returned unchanged,
   * and two pushes racing are caught by the unique index, where the loser
   * reads the winner's row instead of failing. Neither answers `created`.
   *
   * The issuer must be a worker on the project and not its owner: the
   * milestone is the hired freelancer's to bill, and the client is the payer.
   */
  public billMilestone(
    project: Project,
    issuer: User,
    bill: IInvoiceMilestoneBill,
  ): RepoEffect<IInvoiceMilestoneResult> {
    return Effect.gen(this, function* () {
      const accessible = yield* this.assertCanInvoice(project, issuer)

      if (accessible.isOwner(issuer)) {
        return yield* Effect.fail(
          new AccessException(
            'A milestone is billed by the hired worker, not by the client who pays it',
          ),
        )
      }

      if (!Number.isSafeInteger(bill.amountCents) || bill.amountCents <= 0) {
        return yield* Effect.fail(
          new BadRequestError('A milestone bills a whole number of cents'),
        )
      }

      const fromAt = new Date(bill.workStart * 1000)
      const toAt = new Date(bill.workEnd * 1000)

      if (fromAt >= toAt) {
        return yield* Effect.fail(
          new BadRequestError('The milestone period ends before it starts'),
        )
      }

      return yield* this.unitOfWork
        .run((manager) =>
          Effect.gen(this, function* () {
            const already = yield* this.invoiceRepository
              .within(manager)
              .findByMilestoneRef(bill.milestoneRef)

            if (already) {
              return { invoiceId: already.id, created: false }
            }

            const invoice = new Invoice()

            invoice.project = accessible
            invoice.user = issuer
            invoice.fromAt = fromAt
            invoice.toAt = toAt
            invoice.basis = EInvoiceBasis.FIXED
            invoice.milestoneRef = bill.milestoneRef
            invoice.description = bill.description
            invoice.snapshotVersion = EInvoiceSnapshotVersion.V1
            invoice.issuerAddress = WalletAddress.toCanonical(issuer.address)
            invoice.ownerAddress = WalletAddress.toCanonical(
              accessible.user.address,
            )
            invoice.currency = EInvoiceCurrency.USD
            // No hours behind it: zero minutes, no lines, and a stored rate
            // of zero - never one derived by dividing the sum by minutes that
            // do not exist. Zero rather than null because InvoiceRecord v1
            // carries these as integers; the record says `basis: FIXED`
            // beside them, and `reportFor` reads the basis and reports no
            // rate at all.
            invoice.rateHourCents = 0
            invoice.minutesActive = 0
            invoice.lines = []
            invoice.amountCents = bill.amountCents
            invoice.state = EInvoiceState.REQUESTED
            invoice.paidAt = null
            invoice.issuanceKind = EInvoiceIssuanceKind.MILESTONE
            // A milestone is not a cadence period, so the scheduled key never
            // compares it with anything.
            invoice.periodStart = null
            invoice.periodEnd = null

            const saved = yield* this.invoiceRepository
              .within(manager)
              .validateAndSave(invoice)

            return { invoiceId: saved.id, created: true }
          }),
        )
        .pipe(
          // The unique index refusing the row means another push got there
          // first, which is the answer, not a failure.
          Effect.catchAll((error) =>
            InvoiceRepository.isUniqueViolation(error)
              ? this.invoiceRepository
                  .findByMilestoneRef(bill.milestoneRef)
                  .pipe(
                    Effect.flatMap((winner) =>
                      winner
                        ? Effect.succeed({
                            invoiceId: winner.id,
                            created: false,
                          })
                        : Effect.fail(error),
                    ),
                  )
              : Effect.fail(error),
          ),
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
    cadencePeriod?: { start: Date; end: Date },
    correctsInvoiceId?: string,
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
      // Stated rather than left to the column default: this path prices
      // tracked entries by the project's rate, which is what HOURLY means.
      invoice.basis = EInvoiceBasis.HOURLY
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
      // A manual invoice records that it was manual and carries no period, so
      // the unique key never compares it with anything: pressing the button
      // is always allowed and never collides with the schedule.
      invoice.issuanceKind = cadencePeriod
        ? EInvoiceIssuanceKind.SCHEDULED
        : EInvoiceIssuanceKind.MANUAL
      invoice.periodStart = cadencePeriod?.start ?? null
      invoice.periodEnd = cadencePeriod?.end ?? null
      invoice.correctsInvoiceId = correctsInvoiceId ?? null

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
   *
   * Not on an invoice submitted to escrow (409): there the chain settles it,
   * and a hand mark could call paid what the escrow refunded.
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

          // Read from the locked row: a submission that bound the invoice
          // after this request loaded it must still stop the hand mark.
          if (InvoiceEscrow.isBound(current)) {
            return yield* Effect.fail(
              new InvoiceEscrowException(
                `Invoice ${current.id} is submitted to escrow allocation ${current.escrowAllocationId}; only the escrow's confirmed outcome settles it`,
              ),
            )
          }

          invoice.state = current.state
          invoice.paidAt = current.paidAt
          invoice.settlementKind = current.settlementKind

          if ((invoice.state === EInvoiceState.PAID) === isPaid) {
            return invoice
          }

          yield* this.timeRepository
            .within(manager)
            .setPaidForInvoice(invoice, isPaid)

          invoice.state = isPaid ? EInvoiceState.PAID : EInvoiceState.REQUESTED
          invoice.paidAt = isPaid ? new Date() : null
          invoice.settlementKind = isPaid ? EInvoiceSettlementKind.MANUAL : null

          return yield* this.invoiceRepository
            .within(manager)
            .saveSingle(invoice)
        }),
      )
    })
  }

  /**
   * Records a confirmed escrow outcome on the invoice its allocation bills -
   * the one path to PAID that is not the issuer's hand (SPEC.md).
   *
   * The push must describe what MarketplaceEscrow can report (400
   * otherwise), for an invoice this instance knows and bound to exactly that
   * allocation, whose on-chain bill is this invoice's commitment (409
   * otherwise). It carries the allocation's absolute state, so it is
   * idempotent: the same push again, or one a later push has overtaken,
   * changes nothing and answers `applied: false`.
   *
   * A release makes the invoice PAID at the block's time and marks its hours
   * paid, in one transaction with the invoice row locked. A refund records
   * the refund and leaves the invoice and its hours unpaid; being bound, it
   * cannot be marked paid by hand either.
   */
  public recordEscrowSettlement(
    settlement: IInvoiceEscrowSettlement,
  ): RepoEffect<IInvoiceEscrowSettlementResult> {
    return Effect.gen(this, function* () {
      const problem = InvoiceEscrow.settlementProblem(settlement)

      if (problem) {
        return yield* Effect.fail(new BadRequestError(problem))
      }

      const found = yield* this.invoiceRepository.findOneBy({
        where: { id: settlement.invoiceId },
      })

      if (!found) {
        return yield* Effect.fail(
          new InvoiceEscrowException(
            `Invoice ${settlement.invoiceId} is not known to this instance`,
          ),
        )
      }

      return yield* this.unitOfWork.run((manager) =>
        Effect.gen(this, function* () {
          const current = yield* this.invoiceRepository
            .within(manager)
            .findOneForUpdate(found)

          if (!InvoiceEscrow.isBound(current)) {
            return yield* Effect.fail(
              new InvoiceEscrowException(
                `Invoice ${current.id} was never submitted to escrow`,
              ),
            )
          }

          if (!InvoiceEscrow.isBoundTo(current, settlement)) {
            return yield* Effect.fail(
              new InvoiceEscrowException(
                `Invoice ${current.id} is submitted to allocation ${current.escrowAllocationId}, not ${settlement.allocationId.toLowerCase()}`,
              ),
            )
          }

          if (
            settlement.invoiceCommitment !== null &&
            settlement.invoiceCommitment.toLowerCase() !==
              current.escrowCommitment
          ) {
            return yield* Effect.fail(
              new InvoiceEscrowException(
                `Allocation ${current.escrowAllocationId} holds a bill that is not invoice ${current.id}'s commitment`,
              ),
            )
          }

          const progress = InvoiceEscrow.progress(current, settlement)

          if (progress.outcome === 'conflict') {
            return yield* Effect.fail(
              new InvoiceEscrowException(progress.reason),
            )
          }

          if (progress.outcome !== 'apply') {
            return InvoiceManager.settlementResult(current, false)
          }

          const releasing =
            settlement.escrowState === EInvoiceEscrowState.RELEASED &&
            current.escrowState !== EInvoiceEscrowState.RELEASED

          current.settlementKind = EInvoiceSettlementKind.ESCROW
          current.escrowState = settlement.escrowState
          current.escrowGrossBaseUnits = settlement.grossBaseUnits
          current.escrowFeeBaseUnits = settlement.feeBaseUnits
          current.escrowNetBaseUnits = settlement.netBaseUnits
          current.escrowRefundedBaseUnits = settlement.refundedBaseUnits
          current.escrowTxHash = settlement.txHash?.toLowerCase() ?? null
          current.escrowConfirmedAt =
            settlement.confirmedAt === null
              ? null
              : new Date(settlement.confirmedAt * 1000)

          if (releasing) {
            yield* this.timeRepository
              .within(manager)
              .setPaidForInvoice(current, true)

            current.state = EInvoiceState.PAID
            current.paidAt = current.escrowConfirmedAt
          }

          const saved = yield* this.invoiceRepository
            .within(manager)
            .saveSingle(current)

          return InvoiceManager.settlementResult(saved, true)
        }),
      )
    })
  }

  private static settlementResult(
    invoice: Invoice,
    applied: boolean,
  ): IInvoiceEscrowSettlementResult {
    return {
      applied,
      invoiceId: invoice.id,
      state: invoice.state,
      escrowState: invoice.escrowState as EInvoiceEscrowState,
    }
  }

  private assertIssuer(invoice: Invoice, actor: User): void {
    if (!invoice.user || invoice.user.id !== actor.id) {
      throw new AccessException(
        'Only whoever issued an invoice can change whether it is paid',
      )
    }
  }

  /**
   * Issues one cadence period's invoice for one issuer, or nothing.
   *
   * The unit the scheduler works in, and everything that makes the schedule
   * safe lives here rather than in the loop above it:
   *
   * - **Nothing to bill issues nothing.** An empty period leaves no row at
   *   all, not an invoice for zero. A period with nothing in it is not an
   *   event.
   * - **A rerun is idempotent.** The period is looked up inside the
   *   transaction and the invoice the first run raised is returned unchanged;
   *   two runs racing are caught by the unique key on the entity, and the
   *   loser reads the winner's row instead of failing.
   * - **Late time moves forward.** The entries billed are the issuer's
   *   uninvoiced hours that *ended by this period's close*, with no lower
   *   bound, so a Tuesday bucket that syncs a week late is billed by the next
   *   period rather than falling between two invoices.
   * - **The rate is the rate at issuance.** The snapshot is written from the
   *   project as it stands, exactly as a manual invoice's is (DEC-04), so an
   *   owner who changes the rate changes only periods issued after the
   *   change - the invoice already raised keeps what it froze.
   *
   * The issuer must still be a worker on the project: consent persists, but
   * somebody taken off the project is no longer billing for it.
   */
  public issueForPeriod(
    project: Project,
    issuer: User,
    period: IInvoiceCadencePeriod,
  ): RepoEffect<IInvoiceIssueOutcome> {
    return Effect.gen(this, function* () {
      const accessible = yield* this.assertCanInvoice(project, issuer)
      const bounds = {
        start: new Date(period.start),
        end: new Date(period.end),
      }

      return yield* this.unitOfWork
        .run((manager) =>
          Effect.gen(this, function* () {
            const already = yield* this.invoiceRepository
              .within(manager)
              .findScheduledForPeriod(accessible, issuer, bounds)

            if (already) {
              return { invoice: already, created: false }
            }

            const times = yield* this.timeRepository
              .within(manager)
              .findUninvoicedUnpaidTimeForAuthorUntil(
                accessible,
                issuer,
                bounds.end,
                { forUpdate: true },
              )

            if (times.length === 0) {
              return { invoice: null, created: false }
            }

            const invoice = yield* this.issue(
              manager,
              accessible,
              issuer,
              times,
              InvoiceManager.spanOf(times),
              bounds,
            )

            return { invoice, created: true }
          }),
        )
        .pipe(
          // The unique key refusing the row means another run got there
          // first, which is the answer, not a failure.
          Effect.catchAll((error) =>
            InvoiceRepository.isDuplicatePeriod(error)
              ? this.invoiceRepository
                  .findScheduledForPeriod(project, issuer, bounds)
                  .pipe(Effect.map((invoice) => ({ invoice, created: false })))
              : Effect.fail(error),
          ),
        )
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
