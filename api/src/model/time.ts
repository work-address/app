import { TimeInsertionResultDto } from '@/model/dto/time'

export interface ITime {
  id?: string
  note: string | null
  minutesActive: number
  keyboardKeys: number
  mouseKeys: number
  mouseDistance: number
  isPaid: boolean
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
