import type { TFunction } from 'i18next'

/** Rounded non-negative minutes from a fractional hour (e.g. chart values). */
export function formatDurationFromHoursFloat(
  hoursFloat: number,
  t: TFunction,
): string {
  const totalMin = Math.round(Number(hoursFloat) * 60)
  return formatDurationFromMinutes(totalMin, t)
}

export function formatDurationFromMinutes(
  totalMinutes: number,
  t: TFunction,
): string {
  const rounded = Math.round(Number(totalMinutes))
  const safe = Number.isFinite(rounded) ? Math.max(0, rounded) : 0
  const h = Math.floor(safe / 60)
  const m = safe % 60

  if (h <= 0) {
    return t('common.duration.minutesOnly', { minutes: m })
  }
  if (m === 0) {
    return t('common.duration.hoursOnly', { hours: h })
  }
  return t('common.duration.hoursAndMinutes', { hours: h, minutes: m })
}
