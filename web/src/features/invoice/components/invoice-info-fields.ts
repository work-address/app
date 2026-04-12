import type { TFunction } from 'i18next'

import { formatDurationFromMinutes } from '@/features/shared'

export type InvoiceFieldId =
  | 'issueDate'
  | 'timeTotal'
  | 'timeActive'
  | 'keyboard'
  | 'mouse'
  | 'mouseDistance'

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
})

const numberFormatter = new Intl.NumberFormat(undefined)

export type InvoiceInfoFieldRow = {
  id: InvoiceFieldId
  value: string
  hasDesc?: boolean
}

export function getInvoiceInfoFields(t: TFunction): InvoiceInfoFieldRow[] {
  return [
    { id: 'issueDate', value: dateFormatter.format(new Date()) },
    {
      id: 'timeTotal',
      value: formatDurationFromMinutes(4 * 60 + 10, t),
      hasDesc: true,
    },
    {
      id: 'timeActive',
      value: formatDurationFromMinutes(2 * 60 + 10, t),
      hasDesc: true,
    },
    {
      id: 'keyboard',
      value: numberFormatter.format(4983),
      hasDesc: true,
    },
    {
      id: 'mouse',
      value: numberFormatter.format(1834),
      hasDesc: true,
    },
    {
      id: 'mouseDistance',
      value: numberFormatter.format(2_385_910),
      hasDesc: true,
    },
  ]
}
