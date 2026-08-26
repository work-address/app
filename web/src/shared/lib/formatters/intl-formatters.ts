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
