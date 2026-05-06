import { TimeInsertionResultDto } from '@/model/dto/time'

export interface ITime {
  id?: string
  note: string | null
  minutesActive: number
  keyboardKeys: number
  mouseKeys: number
  mouseDistance: number
  fromAt: Date
  toAt: Date
  project?: {
    id: string
  }
  processes?: {
    name: string
    description?: string
    timeMin: number
  }[]
  screenshot?: string | null
}

export interface ITimeTotals {
  projectId: string
  rateHour: number
  rateTotal: number
  minutes: number
  minutesActive: number
  keyboardKeys: number
  mouseKeys: number
  mouseDistance: number
}

/** Batch create/update row outcome; aligned with {@link TimeInsertionResultDto} for OpenAPI. */
export type ITimeInsertionResult = TimeInsertionResultDto
