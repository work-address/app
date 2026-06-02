import type { DurationInputArg1, DurationInputArg2 } from 'moment'

export enum EProjectStatisticsPeriod {
  ONE_DAY = '1D',
  SEVEN_DAYS = '7D',
  ONE_WEEK = '1W',
  ONE_MONTH = '1M',
  SIX_MONTHS = '6M',
  ONE_YEAR = '1Y',
}

export interface IProjectStatisticsPeriodConfig {
  windowAmount: DurationInputArg1
  windowUnit: DurationInputArg2
  refreshAmount: DurationInputArg1
  refreshUnit: DurationInputArg2
}

export interface IProjectStatistics {
  id?: string
  processName: string
  timeMin: number
  period: EProjectStatisticsPeriod
  project?: {
    id: string
  }
}
