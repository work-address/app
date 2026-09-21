import { TimeInsertionResultDto } from '@/model/dto/time'

export interface ITime {
  id?: string
  note: string | null
  minutesActive: number
  keyboardKeys: number
  mouseKeys: number
  mouseDistance: number
  isPaid: boolean
  overWeeklyCap?: boolean | null
  fromAt: Date
  toAt: Date
  project?: {
    id: string
  }
  processes?:
    | {
        name: string
        description?: string
        timeMin: number
      }[]
    | null
  screenshot?: string | null
}

/**
 * A half-open window of tracked time, matched on where a slice starts. Both
 * ends are optional; neither is the project's whole history.
 */
export interface ITimeWindow {
  /** Inclusive. */
  fromAt?: Date
  /** Exclusive, so consecutive weeks neither overlap nor leave a gap. */
  toAt?: Date
}

export interface ITimeTotals {
  projectId: string
  rateHour: number
  rateTotal: number
  minutes: number
  minutesActive: number
  minutesPaid: number
  minutesUnpaid: number
  keyboardKeys: number
  mouseKeys: number
  mouseDistance: number
  /**
   * Minutes past the project's weekly cap inside the window asked for;
   * absent where the project has no cap, or where no window was given - a
   * cap is a claim about one week and means nothing across all of history.
   */
  minutesOverCap?: number
}

/** One contractor's contribution to one project, for the employer report. */
/**
 * A contractor rolled up across every project an employer owns.
 *
 * Cost is summed per project rather than from a single rate: `rateHour` lives
 * on the project, so one contractor on three projects can bill at three rates
 * and a single multiply would be wrong.
 */
/** Batch create/update row outcome; aligned with {@link TimeInsertionResultDto} for OpenAPI. */
export type ITimeInsertionResult = TimeInsertionResultDto

/**
 * What one uploaded row writes onto a Time entry, once resized: the
 * slice's key (project, author, `fromAt`) aside, everything a re-upload can
 * change.
 */
export type TimeUpload = Pick<
  ITime,
  | 'toAt'
  | 'note'
  | 'minutesActive'
  | 'keyboardKeys'
  | 'mouseKeys'
  | 'mouseDistance'
  | 'processes'
> & { screenshot: string | null }

/** For a read of entries the caller is about to write. */
export interface ITimeReadOptions {
  /**
   * Lock the returned rows (`FOR UPDATE`) until the caller's transaction
   * ends, so no concurrent request can invoice or re-flag them in between.
   * Only valid on a repository bound to a `UnitOfWork` transaction.
   */
  forUpdate?: boolean
}

/**
 * Rows sharing one slice of one project, for the author-key audit. Soft-deleted
 * rows count: the unique constraint covers them too.
 */
export interface ITimeSliceGroup {
  projectId: string
  fromAt: Date
  /** Distinct authors of the rows, sorted. */
  userIds: string[]
  /** The rows, oldest first. */
  timeIds: string[]
}

/** What `audit:time-author-key` found. It reads, and never writes. */
export interface ITimeAuthorKeyAudit {
  /** Unique constraints on the time table as it stands. */
  uniqueConstraints: string[]
  /**
   * Slices where one author has more than one row. The new key cannot be
   * added while any exist, so each is for a person to resolve.
   */
  duplicateAuthorSlices: ITimeSliceGroup[]
  /**
   * Slices held by more than one author: refused by the old key, and
   * separate entries under the new one.
   */
  sharedSlices: ITimeSliceGroup[]
}

/** When the retention job runs; both default to the job's own constants. */
export interface IRetentionSchedule {
  /** Between passes. */
  intervalMs?: number
  /** From arming to the first pass, so a restart does not reset the wait. */
  firstRunDelayMs?: number
}

/** What one retention run did, for the log and for the tests. */
export interface IRetentionReport {
  /** Free owners with history due to rotate. */
  owners: number
  /** Owners whose notice this run started; nothing of theirs rotated yet. */
  noticed: number
  /** Entries removed from view this run. */
  rotated: number
  /** Notices ended because the owner is premium again. */
  cleared: number
}

/**
 * GET /time/retention-notice: what rotates out of the caller's history soon,
 * shown on the dashboard before it happens (DEC-05).
 */
export interface IRetentionNotice {
  /** Entries that will be old enough to rotate within `noticeDays`. */
  count: number
  /** ISO instant the first of them can go; null when nothing is due. */
  rotatesAt: string | null
  /** How many days of history the free plan keeps. */
  windowDays: number
  /** How far ahead the dashboard lists what is due. */
  noticeDays: number
}
