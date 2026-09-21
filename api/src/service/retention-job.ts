import { Effect } from 'effect'
import { inject, injectable } from 'inversify'
import moment from 'moment'

import { User } from '@/entity/user'
import { ILogger } from '@/model/logging'
import {
  IRetentionNotice,
  IRetentionReport,
  IRetentionSchedule,
} from '@/model/time'
import { RepoEffect } from '@/repository/abstract-repository-template'
import { TimeRepository } from '@/repository/time-repository'
import { UserRepository } from '@/repository/user-repository'
import { Entitlement } from '@/service/entitlement'
import { TimeManager } from '@/service/time-manager'

/**
 * Rotates free history on a schedule, and never without notice (DEC-05).
 *
 * Retention used to run only inside a time upload, for the projects in that
 * batch: a free owner who stopped syncing kept everything indefinitely, and a
 * lapsed subscriber lost months of history on their next upload with no
 * warning at all. This runs on a timer, needs no upload, and removes nothing
 * until the owner's dashboard has listed it for NOTICE_DAYS:
 *
 * - the first run that finds an owner free with history about to rotate
 *   starts their notice (User.retentionNoticeFrom) and removes nothing;
 * - from NOTICE_DAYS after that, entries older than the free window rotate -
 *   each of them has been on the dashboard notice for at least NOTICE_DAYS,
 *   since the notice lists everything that will be old enough within that
 *   lead time;
 * - an owner who is premium again has their notice ended, so a later lapse
 *   starts a fresh one instead of rotating at once.
 *
 * Rotation is a soft delete: removed from view, not restorable from the
 * product. Invoice evidence and running marketplace contracts are exempt
 * (TimeRepository). SaaS only: a self-hosted instance is unrestricted, and
 * the job is never armed there.
 */
@injectable()
export class RetentionJob {
  /**
   * Hourly, not daily. A timer armed at boot counts from boot, and the
   * production container restarts on every deploy: a 24-hour interval never
   * fires on an API deployed more often than once a day, and since the upload
   * path rotates only after this job has started the owner's notice, the free
   * limit would silently stop being enforced. Every decision in run() compares
   * a stored instant with `now` (noticeFrom + NOTICE_DAYS, fromAt < cutoff),
   * none counts runs, so extra passes change nothing but reliability.
   */
  public static readonly INTERVAL_MS = 60 * 60 * 1000

  /**
   * The first pass, a minute after boot, so that even a process that never
   * lives an hour does the work. Not at once: boot is when the database is
   * busiest, and nothing here is that urgent.
   */
  public static readonly FIRST_RUN_DELAY_MS = 60 * 1000

  /** How long history is listed on the dashboard before it may rotate. */
  public static readonly NOTICE_DAYS = 3

  @inject('TimeRepository')
  protected timeRepository: TimeRepository
  @inject('UserRepository')
  protected userRepository: UserRepository
  @inject('Entitlement')
  protected entitlement: Entitlement
  @inject('ILogger')
  protected logger: ILogger

  private timer: NodeJS.Timeout | null = null
  private firstRun: NodeJS.Timeout | null = null
  private inFlight = false

  /** The instant an owner's notice has run long enough for rotation. */
  public static rotationOpensAt(noticeFrom: Date): Date {
    return moment.utc(noticeFrom).add(RetentionJob.NOTICE_DAYS, 'days').toDate()
  }

  /**
   * Whether an owner has been told for long enough that their expired
   * history may rotate. The upload path asks the same question, so nothing
   * rotates there without notice either.
   */
  public static mayRotate(
    owner: Pick<User, 'retentionNoticeFrom'> | null | undefined,
    now: Date,
  ): boolean {
    const noticeFrom = owner?.retentionNoticeFrom

    return (
      Boolean(noticeFrom) &&
      RetentionJob.rotationOpensAt(new Date(noticeFrom!)).getTime() <=
        now.getTime()
    )
  }

  /** Whether the schedule is armed. */
  public get running(): boolean {
    return this.timer !== null
  }

  /**
   * Arms the schedule, on SaaS only: one pass `firstRunDelayMs` after the
   * call, then one every `intervalMs`. Returns whether it was armed: a
   * self-hosted instance has no free tier, so there is nothing to rotate and
   * no timer to hold. `unref` so no timer keeps the process alive, and a
   * second call is a no-op rather than a second schedule.
   */
  public start(schedule: IRetentionSchedule = {}): boolean {
    if (!this.entitlement.isSaaS()) {
      return false
    }

    if (this.timer) {
      return true
    }

    const {
      intervalMs = RetentionJob.INTERVAL_MS,
      firstRunDelayMs = RetentionJob.FIRST_RUN_DELAY_MS,
    } = schedule

    this.firstRun = setTimeout(() => {
      this.firstRun = null
      void this.runAndLog()
    }, firstRunDelayMs)
    this.firstRun.unref?.()

    this.timer = setInterval(() => {
      void this.runAndLog()
    }, intervalMs)
    this.timer.unref?.()

    return true
  }

  public stop(): void {
    if (this.firstRun) {
      clearTimeout(this.firstRun)
      this.firstRun = null
    }

    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /** One pass: end notices of premium owners, start new ones, rotate. */
  public run(now: Date = new Date()): RepoEffect<IRetentionReport> {
    return Effect.gen(this, function* () {
      const report: IRetentionReport = {
        owners: 0,
        noticed: 0,
        rotated: 0,
        cleared: 0,
      }

      if (!this.entitlement.isSaaS()) {
        return report
      }

      for (const user of yield* this.userRepository.findWithRetentionNotice()) {
        if (this.entitlement.isPremium(user, now)) {
          yield* this.userRepository.clearRetentionNotice(user.id)
          report.cleared += 1
        }
      }

      const candidates = yield* this.timeRepository.findRetentionCandidates(
        this.listedFrom(now),
      )
      const cutoff = RetentionJob.cutoff(now)

      for (const { owner, projectIds } of candidates) {
        if (this.entitlement.isPremium(owner, now)) {
          continue
        }

        report.owners += 1

        if (!owner.retentionNoticeFrom) {
          yield* this.userRepository.startRetentionNotice(owner.id, now)
          report.noticed += 1
          continue
        }

        if (!RetentionJob.mayRotate(owner, now)) {
          continue
        }

        report.rotated +=
          yield* this.timeRepository.softDeleteExpiredEntriesForProjects(
            projectIds,
            cutoff,
          )
      }

      return report
    })
  }

  /**
   * What the owner's dashboard lists: how many entries rotate within the
   * notice lead time, and the earliest moment one can go - never before the
   * owner's notice has run its course, which for an owner the job has not
   * reached yet is at least NOTICE_DAYS from now, and never in the past.
   */
  public notice(
    owner: User,
    now: Date = new Date(),
  ): RepoEffect<IRetentionNotice> {
    return Effect.gen(this, function* () {
      const notice: IRetentionNotice = {
        count: 0,
        rotatesAt: null,
        windowDays: TimeManager.freeTimeLogRetentionDays,
        noticeDays: RetentionJob.NOTICE_DAYS,
      }

      if (this.entitlement.isPremium(owner, now)) {
        return notice
      }

      const due = yield* this.timeRepository.findRotatingForOwner(
        owner.id,
        this.listedFrom(now),
      )

      if (due.count === 0 || !due.oldestFromAt) {
        return notice
      }

      const oldestGoesAt = moment
        .utc(due.oldestFromAt)
        .add(TimeManager.freeTimeLogRetentionDays, 'days')
        .toDate()
      const noticeRunsOut = RetentionJob.rotationOpensAt(
        owner.retentionNoticeFrom ? new Date(owner.retentionNoticeFrom) : now,
      )
      // Never in the past: what is already due goes on the next run.
      const rotatesAt = new Date(
        Math.max(
          oldestGoesAt.getTime(),
          noticeRunsOut.getTime(),
          now.getTime(),
        ),
      )

      return { ...notice, count: due.count, rotatesAt: rotatesAt.toISOString() }
    })
  }

  /** Entries older than the free window, measured from `now`. */
  private static cutoff(now: Date): Date {
    return moment
      .utc(now)
      .subtract(TimeManager.freeTimeLogRetentionDays, 'days')
      .toDate()
  }

  /**
   * Entries that start before this will be old enough to rotate within the
   * notice lead time, which is what the notice lists.
   */
  private listedFrom(now: Date): Date {
    return moment
      .utc(RetentionJob.cutoff(now))
      .add(RetentionJob.NOTICE_DAYS, 'days')
      .toDate()
  }

  /** A pass still running when the next tick comes is not run twice. */
  private async runAndLog(): Promise<void> {
    if (this.inFlight) {
      return
    }

    this.inFlight = true

    try {
      const report = await Effect.runPromise(this.run())

      if (report.rotated > 0 || report.noticed > 0) {
        this.logger.info(
          `RetentionJob: ${report.noticed} owner(s) told, ${report.rotated} entr(ies) rotated`,
        )
      }
    } catch (error: unknown) {
      this.logger.error('RetentionJob: the run failed', error)
    } finally {
      this.inFlight = false
    }
  }
}
