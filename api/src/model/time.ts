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
