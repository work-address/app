import { describeInvoiceRate, isFixedInvoice } from './invoice-snapshot'

import type { ProjectInvoice } from './types'
import type { TFunction } from 'i18next'

import { formatDurationFromMinutes } from '@/shared/lib/formatters/format-duration'
import {
  dateFormatter,
  formatCount,
} from '@/shared/lib/formatters/intl-formatters'

export type InvoiceFieldId =
  | 'issueDate'
  | 'rateHour'
  | 'timeTotal'
  | 'timeActive'
  | 'timePaid'
  | 'timeUnpaid'
  | 'keyboard'
  | 'mouse'
  | 'mouseDistance'

export type InvoiceInfoFieldRow = {
  id: InvoiceFieldId
  value: string
  /**
   * Resolved description, not a flag: the wording is shared with the worklog
   * and project tables via `common.metricDesc.*`, so "time active" means the
   * same thing wherever it is shown.
   */
  desc?: string
}

/**
 * The invoice's summary fields.
 *
 * A fixed-price invoice bills an agreed sum with no tracked time behind it,
 * so it shows its issue date and that its price is fixed - and none of the
 * hour and activity rows, which on it could only ever read zero and would
 * suggest a bill for no work rather than a bill for a deliverable.
 */
export const getInvoiceInfoFields = (
  invoice: Pick<
    ProjectInvoice,
    'createdAt' | 'rateHourCents' | 'basis' | 'report'
  > | null,
  t: TFunction,
): InvoiceInfoFieldRow[] => {
  const report = invoice?.report

  const summary: InvoiceInfoFieldRow[] = [
    {
      id: 'issueDate',
      value: invoice?.createdAt
        ? dateFormatter.format(new Date(invoice.createdAt))
        : '',
    },
    {
      id: 'rateHour',
      // The rate the invoice was issued at, from its snapshot - never the
      // project's current rate, which may have changed since.
      ...describeInvoiceRate(invoice, t),
    },
  ]

  if (isFixedInvoice(invoice)) {
    return summary
  }

  return [
    ...summary,
    {
      id: 'timeTotal',
      value: formatDurationFromMinutes(report?.minutes ?? 0, t),
      desc: t('common.metricDesc.timeTotal'),
    },
    {
      id: 'timeActive',
      value: formatDurationFromMinutes(report?.minutesActive ?? 0, t),
      desc: t('common.metricDesc.timeActive'),
    },
    {
      id: 'timePaid',
      value: formatDurationFromMinutes(report?.minutesPaid ?? 0, t),
      desc: t('common.metricDesc.timePaid'),
    },
    {
      id: 'timeUnpaid',
      value: formatDurationFromMinutes(report?.minutesUnpaid ?? 0, t),
      desc: t('common.metricDesc.timeUnpaid'),
    },
    {
      id: 'keyboard',
      value: formatCount(report?.keyboardKeys),
      desc: t('common.metricDesc.keyboard'),
    },
    {
      id: 'mouse',
      value: formatCount(report?.mouseKeys),
      desc: t('common.metricDesc.mouse'),
    },
    {
      id: 'mouseDistance',
      value: formatCount(report?.mouseDistance),
      desc: t('common.metricDesc.mouseDistance'),
    },
  ]
}
