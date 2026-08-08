import { combine } from 'effector'

import { activityDetailQuery, activityReportQuery } from './queries'

import type { ProjectInvoice } from './types'
import type { ITimeTotalDetail } from '@/entities/time'

export const $invoice = combine(
  activityDetailQuery.$data,
  activityReportQuery.$data,
  (detail, report): ProjectInvoice | null => {
    if (!detail) {
      return null
    }

    const rateHour = report?.totals[0]?.rateHour ?? 0
    const minutesActive = report?.totals[0]?.minutesActive ?? 0

    const totalAmount = (rateHour / 60) * minutesActive

    return {
      ...detail,
      report: report?.totals[0] ?? undefined,
      totalAmount,
    }
  },
)

export const $invoiceTime = combine(
  activityReportQuery.$data,
  (report): ITimeTotalDetail[] => report?.time ?? [],
)

export const $invoiceLoading = combine(
  activityDetailQuery.$pending,
  activityReportQuery.$pending,
  (...flags) => flags.some((flag) => flag),
)
