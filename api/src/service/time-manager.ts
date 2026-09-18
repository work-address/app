import { Cause, Effect } from 'effect'
import { inject, injectable } from 'inversify'
import moment from 'moment'

import { Time } from '@/entity/time'
import { User } from '@/entity/user'
import { TimeRepository } from '@/repository/time-repository'
import { ProjectRepository } from '@/repository/project-repository'
import { ITimeInsertionResult } from '@/model/time'
import { ErrorFormatter } from '@/service/error-formatter'
import { TimeCreateDto } from '@/model/dto/time'
import { Entitlement } from '@/service/entitlement'
import AccessException from '@/exception/access-exception'
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
      const projectIdsUnderRetention = new Set<string>()

      const storeEntry = (
        item: TimeCreateDto,
      ): Effect.Effect<ITimeInsertionResult, unknown> =>
        Effect.gen(this, function* () {
          const fromAt = moment(item.fromAt).toDate()
          const toAt = moment(item.toAt).toDate()

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

          const existing = yield* this.timeRepository.findTimeSingleForProject(
            project,
            fromAt,
            toAt,
          )

          if (existing && existing.user?.id !== user.id) {
            return yield* Effect.fail(
              new AccessException(
                `Wrong user: the given time belongs to someone else`,
              ),
            )
          }

          const time = existing ?? new Time()

          if (!existing) {
            time.user = user
          }

          time.fromAt = fromAt
          time.toAt = toAt
          time.note = item.note
          time.minutesActive = item.minutesActive
          time.keyboardKeys = item.keyboardKeys
          time.mouseKeys = item.mouseKeys
          time.mouseDistance = item.mouseDistance
          time.project = project
          time.screenshot = yield* fromPromise(() =>
            this.resize(item.screenshot),
          )
          time.processes = item.processes

          const savedTime = yield* this.timeRepository.validateAndSave(time)

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

  /** Fails with a 409 naming the invoices if any of the entries has one. */
  private static refuseInvoiced(times: Time[]): Effect.Effect<void, unknown> {
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
      new InvoicedTimeException(
        `Payment for invoiced time follows its invoice - mark invoice ${invoiceIds.join(', ')} paid or unpaid instead`,
      ),
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

  public removeMany(ids: string[], user: User): RepoEffect<void> {
    return Effect.gen(this, function* () {
      const times = yield* this.timeRepository.findByIdsAsAuthor(ids, user)

      yield* this.timeRepository.removeMany(times)
    })
  }

  public async resize(screenshot?: string): Promise<string | null> {
    if (!screenshot) {
      return null
    }

    return this.imageResizer.resize(screenshot, 600)
  }
}
