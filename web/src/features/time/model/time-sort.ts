import type { TimeSort } from '@/entities/time'

export type TimeSortOrder = 'ASC' | 'DESC'

export type TimeSortField =
  | 'fromAt'
  | 'projectName'
  | 'paidStatus'
  | 'minutesActive'
  | 'note'
  | 'screenshot'
  | 'keyboardKeys'
  | 'mouseKeys'
  | 'mouseDistance'

/**
 * Every column the feed can be ordered by, in the order the list shows them.
 *
 * One list rather than one per view: the table sorts from its headers and the
 * grid from a select, and a field offered by only one of them would be a sort
 * the other could not undo.
 */
export const TIME_SORT_FIELDS: { field: TimeSortField; labelKey: string }[] = [
  { field: 'fromAt', labelKey: 'dashboard.worklogsTable.head.date' },
  {
    field: 'projectName',
    labelKey: 'dashboard.worklogsTable.head.projectName',
  },
  {
    field: 'paidStatus',
    labelKey: 'dashboard.worklogsTable.head.paymentStatus',
  },
  {
    field: 'minutesActive',
    labelKey: 'dashboard.worklogsTable.head.timeActive',
  },
  { field: 'note', labelKey: 'dashboard.worklogsTable.head.note' },
  { field: 'screenshot', labelKey: 'dashboard.worklogsTable.head.screenshot' },
  {
    field: 'keyboardKeys',
    labelKey: 'dashboard.worklogsTable.head.keyboard',
  },
  { field: 'mouseKeys', labelKey: 'dashboard.worklogsTable.head.mouse' },
  {
    field: 'mouseDistance',
    labelKey: 'dashboard.worklogsTable.head.mouseDistance',
  },
]

export const DEFAULT_TIME_SORT_FIELD: TimeSortField = 'fromAt'
export const DEFAULT_TIME_SORT_ORDER: TimeSortOrder = 'DESC'

const isSortOrder = (value: string | undefined): value is TimeSortOrder =>
  value === 'ASC' || value === 'DESC'

/**
 * The column the feed is ordered by.
 *
 * The store can hold more than one key - `appendTimeSort` merges - so the
 * first known field wins rather than whichever key the object happens to
 * enumerate first.
 */
export const getTimeSortField = (sort: TimeSort): TimeSortField =>
  TIME_SORT_FIELDS.find((entry) => isSortOrder(sort[entry.field]))?.field ??
  DEFAULT_TIME_SORT_FIELD

export const getTimeSortOrder = (sort: TimeSort): TimeSortOrder => {
  const order = sort[getTimeSortField(sort)]

  return isSortOrder(order) ? order : DEFAULT_TIME_SORT_ORDER
}

/** Replaces the sort rather than merging, matching what a header click does. */
export const toTimeSort = (
  field: TimeSortField,
  order: TimeSortOrder,
): TimeSort => ({ [field]: order })
