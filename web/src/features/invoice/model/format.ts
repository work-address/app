/** Minutes as `3 hr 20 min`, matching the duration keys already in common. */
export const formatMinutes = (
  minutes: number,
  t: (key: string, params?: Record<string, unknown>) => string,
): string => {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  if (hours > 0 && rest > 0) {
    return t('common.duration.hoursAndMinutes', { hours, minutes: rest })
  }

  if (hours > 0) {
    return t('common.duration.hoursOnly', { hours })
  }

  return t('common.duration.minutesOnly', { minutes: rest })
}

/**
 * Whole cents as `$1234.50`.
 *
 * Money is integer cents everywhere - `Invoice.amountCents` - and only becomes
 * a decimal string here, at the edge. Nothing upstream should divide by 100.
 */
export const formatCents = (cents: number): string =>
  `$${(Math.trunc(Number(cents)) / 100).toFixed(2)}`

/** `0x1234…abcd` — enough to recognise a wallet without wrapping a table cell. */
export const shortenAddress = (address: string): string =>
  address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
