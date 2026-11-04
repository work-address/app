import type { InvoiceRead } from './types'
import type { SortOrder } from '@/shared'

import { sortRowsBy } from '@/shared'

type InvoiceTimeRow = NonNullable<InvoiceRead['time']>[number]

export type WorklogSortField =
  | 'createdAt'
  | 'note'
  | 'timeActive'
  | 'keyboardKeys'
  | 'mouseKeys'
  | 'mouseDistance'

export type WorklogSort = Partial<Record<WorklogSortField, SortOrder>>

/** Newest first, as the worklogs open on the time page. */
export const DEFAULT_WORKLOG_SORT: WorklogSort = { createdAt: 'DESC' }

export const WORKLOG_SORT_FIELDS: {
  field: WorklogSortField
  labelKey: string
}[] = [
  { field: 'createdAt', labelKey: 'dashboard.worklogsTable.head.date' },
  { field: 'note', labelKey: 'dashboard.worklogsTable.head.note' },
  { field: 'timeActive', labelKey: 'dashboard.worklogsTable.head.timeActive' },
  { field: 'keyboardKeys', labelKey: 'dashboard.worklogsTable.head.keyboard' },
  { field: 'mouseKeys', labelKey: 'dashboard.worklogsTable.head.mouse' },
  {
    field: 'mouseDistance',
    labelKey: 'dashboard.worklogsTable.head.mouseDistance',
  },
]

const READERS: Record<
  WorklogSortField,
  (row: InvoiceTimeRow) => string | number | null | undefined
> = {
  // The date column leads with the entry's own time span.
  createdAt: (row) => row.fromAt ?? row.createdAt,
  note: (row) => row.note,
  timeActive: (row) => row.minutesActive,
  keyboardKeys: (row) => row.keyboardKeys,
  mouseKeys: (row) => row.mouseKeys,
  mouseDistance: (row) => row.mouseDistance,
}

/**
 * The entries an invoice bills, in the order asked for. Sorted here rather than
 * by the server: the invoice read returns every entry at once.
 */
export const sortInvoiceWorklogs = (
  rows: readonly InvoiceTimeRow[],
  sort: WorklogSort,
): InvoiceTimeRow[] => {
  const [field, order] = (Object.entries(sort)[0] ?? []) as [
    WorklogSortField | undefined,
    SortOrder | undefined,
  ]

  return field && order && field in READERS
    ? sortRowsBy(rows, READERS[field], order, (row) => row.id ?? '')
    : [...rows]
}
