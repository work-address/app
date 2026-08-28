import { combine } from 'effector'

import {
  activityDetailQuery,
  activityReportQuery,
  invoiceQuery,
} from './queries'

import type { ProjectInvoice } from './types'
import type { ITimeTotalDetail } from '@/entities/time'

export const $invoice = combine(
  invoiceQuery.$data,
  activityDetailQuery.$data,
  activityReportQuery.$data,
  (record, detail, report): ProjectInvoice | null => {
    if (!record || !detail) {
      return null
    }

    return {
      ...detail,
      report: report?.totals[0] ?? undefined,
      record,
      // Read from the stored invoice, never recomputed. The old code derived
      // this from the project's *current* total active minutes, so it summed
      // every contributor's hours - including already-paid ones - and moved
      // every time anyone tracked more.
      totalAmount: Number(record.amountCents ?? 0) / 100,
    }
  },
)

export const $invoiceTime = combine(
  activityReportQuery.$data,
  (report): ITimeTotalDetail[] => report?.time ?? [],
)

export const $invoiceLoading = combine(
  invoiceQuery.$pending,
  activityDetailQuery.$pending,
  activityReportQuery.$pending,
  (...flags) => flags.some((flag) => flag),
)
