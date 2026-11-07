/** Compact headline units; normalization matches the shared duration formatter. */
export function formatCompactDurationFromMinutes(
  minutes: number,
  locale: string,
) {
  const rounded = Math.round(Number(minutes))
  const safe = Number.isFinite(rounded) ? Math.max(0, rounded) : 0
  const hours = Math.floor(safe / 60)
  const remainder = safe % 60
  const unit = (value: number, name: 'hour' | 'minute') =>
    new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: name,
      unitDisplay: 'narrow',
      useGrouping: false,
    })
      .format(value)
      .replaceAll(/\s+/g, '')

  if (hours === 0) {
    return unit(remainder, 'minute')
  }
  if (remainder === 0) {
    return unit(hours, 'hour')
  }
  return `${unit(hours, 'hour')}\u202f${unit(remainder, 'minute')}`
}
