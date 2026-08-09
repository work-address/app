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
