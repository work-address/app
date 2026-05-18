import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'

import { $invoice } from '../model'

import {
  dateFormatter,
  numberFormatter,
  formatDurationFromMinutes,
} from '@/shared'

export type InvoiceFieldId =
  | 'issueDate'
  | 'timeTotal'
  | 'timeActive'
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

  return [
    {
      id: 'issueDate',
      value: dateFormatter.format(new Date(invoice?.createdAt ?? Date.now())),
    },
    {
      id: 'timeTotal',
      value: formatDurationFromMinutes(invoice?.report?.minutes ?? 0, t),
      hasDesc: true,
    },
    {
      id: 'timeActive',
      value: formatDurationFromMinutes(invoice?.report?.minutesActive ?? 0, t),
      hasDesc: true,
    },
    {
      id: 'keyboard',
      value: numberFormatter.format(invoice?.report?.keyboardKeys ?? 0),
      hasDesc: true,
    },
    {
      id: 'mouse',
      value: numberFormatter.format(invoice?.report?.mouseKeys ?? 0),
      hasDesc: true,
    },
    {
      id: 'mouseDistance',
      value: numberFormatter.format(invoice?.report?.mouseDistance ?? 0),
      hasDesc: true,
    },
  ]
}
