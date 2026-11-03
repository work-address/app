import { TimeInsertionResultDto } from '@/model/dto/time'

export interface ITime {
  id?: string
  note: string | null
  minutesActive: number | null
  keyboardKeys: number | null
  mouseKeys: number | null
  mouseDistance: number | null
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

/** What `/time/totals` answers; a figure the reader may not see is absent. */
export interface ITimeTotals {
  projectId: string
  minutes: number
  rateHour?: number
  minutesActive?: number
  minutesPaid?: number
  minutesUnpaid?: number
  keyboardKeys?: number
  mouseKeys?: number
  mouseDistance?: number
  earnedCents?: number
  paidCents?: number
  unpaidCents?: number
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
