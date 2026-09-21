import { Cause, Effect } from 'effect'
import { inject, injectable } from 'inversify'
import moment from 'moment'
import _ from 'lodash'

import { Project } from '@/entity/project'
import { Time } from '@/entity/time'
import { User } from '@/entity/user'
import { TimeRepository } from '@/repository/time-repository'
import { WeeklyCap } from '@/service/weekly-cap'
import { ProjectRepository } from '@/repository/project-repository'
import {
  ITimeInsertionResult,
  ITimeTotals,
  ITimeWindow,
  TimeUpload,
} from '@/model/time'
import { ErrorFormatter } from '@/service/error-formatter'
import { TimeBounds } from '@/service/time-bounds'
import ConstraintsValidationException from '@/exception/constraints-validation-exception'
import { TimeCreateDto } from '@/model/dto/time'
import { Entitlement } from '@/service/entitlement'
import InvoicedTimeException from '@/exception/invoiced-time-exception'
import RetentionExceededException from '@/exception/retention-exceeded-exception'
import { ImageResizer } from '@/service/image-resizer'
import { RepoEffect } from '@/repository/abstract-repository-template'
import { fromPromise } from '@/service/effect-bridge'
import { UnitOfWork } from '@/service/unit-of-work'

@injectable()
export class TimeManager {
  @inject('TimeRepository')
  protected timeRepository: TimeRepository
  @inject('ProjectRepository')
  protected projectRepository: ProjectRepository
  @inject('ImageResizer')
  protected imageResizer: ImageResizer
  @inject('Entitlement')
  protected entitlement: Entitlement
  @inject('UnitOfWork')
  protected unitOfWork: UnitOfWork

  // Projects owned by a non-premium account keep only the trailing N days of
  // time logs. Entitlement is the project owner's, not the author's - see
  // TimeRepository.softDeleteExpiredEntriesForProjects.
  // Kept at 14 to match what the pricing page advertises - the two must not
  // drift, or the free tier silently under-delivers what was sold.
  public static freeTimeLogRetentionDays: number = 14

  public static retentionCutoff(): Date {
    return moment
      .utc()
      .subtract(TimeManager.freeTimeLogRetentionDays, 'days')
      .toDate()
  }

  /**
   * A tracker syncs a batch and each entry succeeds or fails on its own, so one
   * bad row must not sink the rest. That partial success used to be a `catch`
   * inside a loop pushing into a shared array; as an Effect the per-entry
   * failure is in the type, and the "one bad entry is a result, not an
   * exception" rule lives in one place instead of being re-stated per branch.
   */
  public createOrUpdateMany(
    data: TimeCreateDto[],
    user: User,
  ): RepoEffect<ITimeInsertionResult[]> {
    // Effect.suspend so the cutoff and the retention set belong to each run
    // rather than to the moment the effect was built. An effect is a
    // description that may be run more than once - a retry, say - and a Set
    // shared across runs would let a later attempt purge projects that only an
    // earlier one touched, deleting time entries the current batch never saw.
    return Effect.suspend(() => {
      // Fixed for the whole request so every entry is judged against the same
      // window, and so the purge below cannot move past what was just accepted.
      const retentionCutoff = TimeManager.retentionCutoff()
      // One clock read for the batch, so every row's "not in the future" is
      // measured against the same instant.
      const now = moment.utc().toDate()
      const projectIdsUnderRetention = new Set<string>()

      const storeEntry = (
        item: TimeCreateDto,
      ): Effect.Effect<ITimeInsertionResult, unknown> =>
        Effect.gen(this, function* () {
          // UTC, not the server's zone: the desktop tracker sends Qt::ISODate
          // text in UTC with no zone ("2026-01-27T12:10:00"), and read as
          // local time every slice moved by the host's offset. A timestamp
          // that names its offset or Z keeps it.
          const fromAt = moment.utc(item.fromAt).toDate()
          const toAt = moment.utc(item.toAt).toDate()

          const project =
            yield* this.projectRepository.findProjectForTimeTracking(
              item.projectId,
              user,
            )

          if (!this.entitlement.isPremium(project.user)) {
            projectIdsUnderRetention.add(project.id)

            // Refuse rather than accept-and-purge: saving this row and deleting
            // it moments later would hand the client an id for a row that no
            // longer exists, and a syncing tracker would drop its local copy.
            if (fromAt < retentionCutoff) {
              return yield* Effect.fail(
                new RetentionExceededException(
                  `Entry starts before the ${TimeManager.freeTimeLogRetentionDays}-day retention window of this project's plan and was not stored`,
                ),
              )
            }
          }

          const violations = TimeBounds.violations(item, { fromAt, toAt }, now)

          if (violations.length > 0) {
            return yield* Effect.fail(
              new ConstraintsValidationException(violations),
            )
          }

          // Resized before the transaction below: it is the slow part, and
          // the row lock should not wait on it.
          const upload: TimeUpload = {
            toAt,
            note: item.note,
            minutesActive: item.minutesActive,
            keyboardKeys: item.keyboardKeys,
            mouseKeys: item.mouseKeys,
            mouseDistance: item.mouseDistance,
            screenshot: yield* fromPromise(() => this.resize(item.screenshot)),
            processes: item.processes,
          }

          const savedTime = yield* this.unitOfWork.run((manager) =>
            Effect.gen(this, function* () {
              const times = this.timeRepository.within(manager)
              // The caller's own row for this slice, locked so an invoice
              // cannot claim it between the check below and the write. Anyone
              // else's row for the same slice is theirs and stays as it is:
              // the key includes the author, so a colleague tracking at the
              // same time is not a clash.
              const existing = yield* times.findAuthorsSlice(
                project,
                user,
                fromAt,
                { forUpdate: true },
              )

              if (existing && (existing.invoiceId || existing.isPaid)) {
                return yield* TimeManager.keepSettled(existing, upload)
              }

              const time = existing ?? new Time()

              if (!existing) {
                time.user = user
              }

              Object.assign(time, upload)
              time.fromAt = fromAt
              time.project = project
              time.overWeeklyCap = yield* TimeManager.beyondWeeklyCap(
                times,
                project,
                time,
                fromAt,
                toAt,
              )

              return yield* times.validateAndSave(time)
            }),
          )

          return {
            ...item,
            id: savedTime.id,
            screenshot: undefined,
            processes: undefined,
          }
        })

      const program = Effect.gen(this, function* () {
        // Sequential on purpose: Effect.forEach runs without concurrency unless
        // asked, and both the result order the tracker reconciles against and the
        // retention set built along the way depend on that.
        const insertionResults = yield* Effect.forEach(data, (item) =>
          storeEntry(item).pipe(
            // catchAllCause, not catchAll: the loop this replaced caught every
            // throw, so a defect must land in the result row too rather than
            // failing the whole batch.
            Effect.catchAllCause((cause) =>
              Effect.succeed({
                ...item,
                error: ErrorFormatter.format(Cause.squash(cause)),
                screenshot: undefined,
                processes: undefined,
              }),
            ),
          ),
        )

        if (projectIdsUnderRetention.size > 0) {
          yield* this.timeRepository.softDeleteExpiredEntriesForProjects(
            [...projectIdsUnderRetention],
            retentionCutoff,
          )
        }

        return insertionResults
      })

      return program
    })
  }

  /**
   * Whether this entry falls beyond the project's weekly cap.
   *
   * Flagged, never refused: the hours were worked, and a tracker that
   * dropped them would destroy the only record of work someone did. The
   * overage is reported to both sides instead (`getTotals`), and they
   * settle it between them.
   *
   * Measured against the week the entry lands in, read under the same lock
   * the entry is written under, and with this entry's own row excluded from
   * the week so a re-upload of the same slice is not counted twice. A
   * project with no cap is never flagged - there is nothing to be beyond.
   */
  private static beyondWeeklyCap(
    times: TimeRepository,
    project: Project,
    time: Time,
    fromAt: Date,
    toAt: Date,
  ): Effect.Effect<boolean, unknown> {
    if (WeeklyCap.minutes(project) === null) {
      return Effect.succeed(false)
    }

    const ownMinutes = Math.round((toAt.getTime() - fromAt.getTime()) / 60_000)

    return times
      .minutesInWindow(project, WeeklyCap.periodAt(project, fromAt), time.id)
      .pipe(
        Effect.map(
          (weekMinutes) =>
            (WeeklyCap.overage(project, weekMinutes + ownMinutes) ?? 0) > 0,
        ),
      )
  }

  /**
   * A re-upload over an entry an invoice bills, or one marked paid (REC-02).
   *
   * Such an entry is evidence for money already asked for or received, so a
   * tracker re-syncing its slice must not rewrite it - the partial-bucket
   * re-upload used to replace its minutes and counters wholesale, under an
   * issued invoice. The same values again change nothing and are answered
   * with the entry's id, so a tracker that retries is not told it failed;
   * anything different is refused for this row alone, and the entry stays
   * as it was.
   */
  private static keepSettled(
    existing: Time,
    upload: TimeUpload,
  ): Effect.Effect<Time, InvoicedTimeException> {
    const changed = TimeManager.changedFields(existing, upload)

    if (changed.length === 0) {
      return Effect.succeed(existing)
    }

    const fields = changed.join(', ')

    return Effect.fail(
      new InvoicedTimeException(
        existing.invoiceId
          ? `Invoice ${existing.invoiceId} bills this entry, so a re-upload cannot change it (${fields}). Nothing was changed`
          : `This entry is marked paid, so a re-upload cannot change it (${fields}) - mark it unpaid first. Nothing was changed`,
      ),
    )
  }

  /**
   * The fields a save of `upload` onto `existing` would change. A field the
   * upload leaves undefined is one the save would not write.
   */
  private static changedFields(existing: Time, upload: TimeUpload): string[] {
    const same: Record<keyof TimeUpload, boolean> = {
      toAt: existing.toAt.getTime() === upload.toAt.getTime(),
      note: upload.note === undefined || existing.note === upload.note,
      minutesActive: existing.minutesActive === upload.minutesActive,
      keyboardKeys: existing.keyboardKeys === upload.keyboardKeys,
      mouseKeys: existing.mouseKeys === upload.mouseKeys,
      mouseDistance: existing.mouseDistance === upload.mouseDistance,
      screenshot: (existing.screenshot ?? null) === upload.screenshot,
      processes:
        upload.processes === undefined ||
        _.isEqual(existing.processes ?? null, upload.processes ?? null),
    }

    return Object.entries(same)
      .filter(([, isSame]) => !isSame)
      .map(([field]) => field)
  }

  /**
   * Rolled-up time for one project, optionally inside one window - a
   * contract week, as the marketplace asks for it.
   *
   * Here rather than straight on the repository because a total is a
   * statement about the agreement as well as the rows: what was tracked,
   * and how it stands against the weekly cap those hours were agreed under.
   */
  public getTotals(
    user: User,
    project: Project,
    window?: ITimeWindow,
  ): RepoEffect<ITimeTotals[]> {
    return this.timeRepository.getTotals(user, project.id, window)
  }

  public save(time: Time): RepoEffect<Time> {
    return this.timeRepository.validateAndSave(time)
  }

  /**
   * The author marks their own entries paid or unpaid by hand - allowed only
   * for entries no invoice covers.
   *
   * An invoiced entry's `isPaid` belongs to its invoice (SPEC.md, "Time.isPaid
   * is owned by Invoice"): flipping it here would leave a PAID invoice owning
   * unpaid hours, or a REQUESTED one owning paid hours. One invoiced entry
   * refuses the whole request with a 409 that names the invoice, so a bulk
   * action never half-applies. The rows are locked while they are checked
   * and written, so an invoice cannot claim one in between.
   */
  public setIsPaidMany(
    ids: string[],
    isPaid: boolean,
    user: User,
  ): RepoEffect<void> {
    return this.unitOfWork.run((manager) =>
      Effect.gen(this, function* () {
        const times = yield* this.timeRepository
          .within(manager)
          .findByIdsAsAuthor(ids, user, { forUpdate: true })

        yield* TimeManager.refuseInvoiced(times)

        for (const time of times) {
          time.isPaid = isPaid
        }

        yield* this.timeRepository.within(manager).saveMany(times)
      }),
    )
  }

  /**
   * A single-entry edit from the time dialog: the note always, `isPaid` only
   * while no invoice covers the entry.
   *
   * The dialog sends `isPaid` with every save, so sending the value the entry
   * already has is not a change and an invoiced entry's note stays editable.
   * The edit is applied to the row as locked now, not to the copy the request
   * loaded: saving that copy could write back an `isPaid` an invoice changed
   * in the meantime.
   */
  public editAndSave(time: Time, data: Time): RepoEffect<void> {
    return this.unitOfWork.run((manager) =>
      Effect.gen(this, function* () {
        const [current] = yield* this.timeRepository
          .within(manager)
          .findByIdsAsAuthor([time.id], time.user, { forUpdate: true })

        if (
          data.isPaid !== undefined &&
          data.isPaid !== Boolean(current.isPaid)
        ) {
          yield* TimeManager.refuseInvoiced([current])

          current.isPaid = data.isPaid
        }

        current.note = data.note

        yield* this.timeRepository.within(manager).validateAndSave(current)
      }),
    )
  }

  /**
   * Fails with a 409 naming the invoices if any of the entries has one. The
   * default message is the payment one; deletion passes its own.
   */
  private static refuseInvoiced(
    times: Time[],
    message: (invoiceIds: string) => string = (invoiceIds) =>
      `Payment for invoiced time follows its invoice - mark invoice ${invoiceIds} paid or unpaid instead`,
  ): Effect.Effect<void, unknown> {
    const invoiceIds = [
      ...new Set(
        times
          .map((time) => time.invoiceId)
          .filter((id): id is string => Boolean(id)),
      ),
    ]

    if (invoiceIds.length === 0) {
      return Effect.void
    }

    return Effect.fail(
      new InvoicedTimeException(message(invoiceIds.join(', '))),
    )
  }

  public removeScreenshots(ids: string[], user: User): RepoEffect<void> {
    return Effect.gen(this, function* () {
      const times = yield* this.timeRepository.findByIdsAsAuthor(ids, user)

      for (const time of times) {
        time.screenshot = null
      }

      yield* this.timeRepository.saveMany(times)
    })
  }

  public removeProcesses(ids: string[], user: User): RepoEffect<void> {
    return Effect.gen(this, function* () {
      const times = yield* this.timeRepository.findByIdsAsAuthor(ids, user)

      for (const time of times) {
        time.processes = null
      }

      yield* this.timeRepository.saveMany(times)
    })
  }

  /**
   * Deletes the author's own entries - never one an invoice bills.
   *
   * An issued invoice is a record of money owed for specific hours; deleting
   * one of those hours would leave the invoice charging for work the work
   * record no longer shows (DEC-04). One invoiced entry refuses the whole
   * request with a 409 naming the invoice, so a bulk delete never
   * half-applies; a mistaken invoice is corrected by a new one, not by
   * editing the evidence under the old. Screenshots and processes are
   * monitoring evidence rather than billing, and stay removable on their own
   * (`removeScreenshots`, `removeProcesses`).
   *
   * The rows are locked while they are checked and deleted, so an invoice
   * cannot claim one in between.
   */
  public removeMany(ids: string[], user: User): RepoEffect<void> {
    return this.unitOfWork.run((manager) =>
      Effect.gen(this, function* () {
        const times = yield* this.timeRepository
          .within(manager)
          .findByIdsAsAuthor(ids, user, { forUpdate: true })

        yield* TimeManager.refuseInvoiced(
          times,
          (invoiceIds) =>
            `Invoiced time cannot be deleted - invoice ${invoiceIds} bills it. Nothing was deleted`,
        )

        yield* this.timeRepository.within(manager).removeMany(times)
      }),
    )
  }

  public async resize(screenshot?: string): Promise<string | null> {
    if (!screenshot) {
      return null
    }

    return this.imageResizer.resize(screenshot, 600)
  }
}
