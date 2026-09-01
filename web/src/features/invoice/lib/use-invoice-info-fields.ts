import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'

import { $invoice } from '../model'

import {
  dateFormatter,
  formatCount,
  formatCurrency,
  formatDurationFromMinutes,
} from '@/shared'

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

export const useInvoiceInfoFields = (): InvoiceInfoFieldRow[] => {
  const { t } = useTranslation()
  const invoice = useUnit($invoice)

  const report = invoice?.report

  return [
    {
      id: 'issueDate',
      value: invoice?.createdAt
        ? dateFormatter.format(new Date(invoice.createdAt))
        : '',
    },
    {
      id: 'rateHour',
      value: formatCurrency(report?.rateHour),
      desc: t('common.metricDesc.rateHour'),
    },
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
