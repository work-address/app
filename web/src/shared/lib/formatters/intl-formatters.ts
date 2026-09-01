import { BASE_CURRENCY } from '../../constants/currency'

export const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
})

export const numberFormatter = new Intl.NumberFormat(undefined)

export const formatAmount = (
  value: number | string | null | undefined,
): string => Number(value ?? 0).toFixed(2)

export const formatCurrency = (
  value: number | string | null | undefined,
): string => `${BASE_CURRENCY.symbol}${formatAmount(value)}`

/**
 * Whole numbers with digit grouping, for the tracked counters - keystrokes,
 * clicks, pointer distance. The tracker reports distance with full float
 * precision, which is noise at a glance and wraps onto a second line.
 */
const countFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
})

export const formatCount = (
  value: number | string | null | undefined,
): string => countFormatter.format(Number(value ?? 0) || 0)
