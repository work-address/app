/**
 * How many entries each scroll to the end adds. A month of 10-minute entries
 * runs to hundreds of rows; they are all in memory, but drawing them at once is
 * tens of thousands of pixels nobody asked for yet.
 */
export const WORKLOG_PAGE_ROWS = 25

/** How many entries to show after reaching the end of `shown`. */
export const nextWorklogCount = (shown: number, total: number): number =>
  Math.min(shown + WORKLOG_PAGE_ROWS, total)
