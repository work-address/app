import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'

import { $invoice } from '../model'

import {
  dateFormatter,
  formatCurrency,
  numberFormatter,
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
  hasDesc?: boolean
}

export const useInvoiceInfoFields = (): InvoiceInfoFieldRow[] => {
  const { t } = useTranslation()
  const invoice = useUnit($invoice)

  const report = invoice?.report

  return [
    {
      id: 'issueDate',
      value: dateFormatter.format(new Date(invoice?.createdAt ?? Date.now())),
    },
    {
      id: 'rateHour',
      value: formatCurrency(report?.rateHour),
    },
    {
      id: 'timeTotal',
      value: formatDurationFromMinutes(report?.minutes ?? 0, t),
      hasDesc: true,
    },
    {
      id: 'timeActive',
      value: formatDurationFromMinutes(report?.minutesActive ?? 0, t),
      hasDesc: true,
    },
    {
      id: 'timePaid',
      value: formatDurationFromMinutes(report?.minutesPaid ?? 0, t),
    },
    {
      id: 'timeUnpaid',
      value: formatDurationFromMinutes(report?.minutesUnpaid ?? 0, t),
    },
    {
      id: 'keyboard',
      value: numberFormatter.format(report?.keyboardKeys ?? 0),
      hasDesc: true,
    },
    {
      id: 'mouse',
      value: numberFormatter.format(report?.mouseKeys ?? 0),
      hasDesc: true,
    },
    {
      id: 'mouseDistance',
      value: numberFormatter.format(report?.mouseDistance ?? 0),
      hasDesc: true,
    },
  ]
}
