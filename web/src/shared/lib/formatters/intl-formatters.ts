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

/** Money for reading: cents always shown, thousands grouped ($9,876.50). */
const moneyFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const formatCurrency = (
  value: number | string | null | undefined,
): string =>
  `${BASE_CURRENCY.symbol}${moneyFormatter.format(Number(value ?? 0))}`

const wholeMoneyFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
})

/** An hourly rate: cents only when there are some ($80, but $80.50). */
export const formatRate = (
  value: number | string | null | undefined,
): string => {
  const amount = Number(value ?? 0)

  return Number.isInteger(amount)
    ? `${BASE_CURRENCY.symbol}${wholeMoneyFormatter.format(amount)}`
    : formatCurrency(amount)
}

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
