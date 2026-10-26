/**
 * A tracked input count for a table cell: grouped digits, or a dash when the
 * entry never recorded one. The API types the counts as numbers, but manual
 * and legacy entries arrive without them, and `String(null)` in a cell
 * reads as a bug rather than as "nothing to count".
 */
export const formatTrackedCount = (
  value: number | null | undefined,
  formatter: Intl.NumberFormat,
): string => (value == null ? '—' : formatter.format(value))
