/** Formats one date with a date-fns pattern, in whatever locale the caller chose. */
export type DatePatternFormatter = (date: Date, pattern: string) => string

/**
 * A period as one phrase rather than two dates: `12th – 18th Oct 2026`
 * inside a month, `28th Sep – 4th Oct 2026` inside a year, and both dates in
 * full across years. The formatter comes in so the locale stays the caller's.
 */
export const formatDateRange = (
  from: Date,
  to: Date,
  format: DatePatternFormatter,
): string => {
  const sameYear = from.getFullYear() === to.getFullYear()
  const sameMonth = sameYear && from.getMonth() === to.getMonth()

  if (sameMonth) {
    return `${format(from, 'do')} – ${format(to, 'do MMM yyyy')}`
  }

  if (sameYear) {
    return `${format(from, 'do MMM')} – ${format(to, 'do MMM yyyy')}`
  }

  return `${format(from, 'do MMM yyyy')} – ${format(to, 'do MMM yyyy')}`
}
