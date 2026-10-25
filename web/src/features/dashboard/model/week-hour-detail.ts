import type { StatisticsHourlyRow } from '@/entities/statistics'

export type WeekHourDetail = {
  activeMinutes: number
  trackedMinutes: number
  /** Active part of the tracked time, 0-1; null with nothing measured. */
  activeShare: number | null
  /** Days this weekday-hour had time, out of the weeks in the stretch. */
  days: number
  weeks: number
  /** Active minutes in a usual week. */
  weeklyMinutes: number
  /** This hour's part of all the reader's active time, 0-1. */
  share: number
  /** 1 for the hour with the most active time; null for an idle hour. */
  rank: number | null
  /** Hours with any active time, which the rank is out of. */
  rankedHours: number
  keysPerActiveHour: number | null
  clicksPerActiveHour: number | null
  busiest: boolean
}

/**
 * Everything a heatmap cell says in context: how much of the hour was worked
 * and how often, what it is in a usual week, how it ranks against the
 * reader's other hours, and how intense the input was.
 */
export function weekHourDetail(
  row: StatisticsHourlyRow | undefined,
  rows: StatisticsHourlyRow[],
  days: number,
): WeekHourDetail {
  const weeks = Math.max(1, Math.round(days / 7))
  const active = row?.activeSeconds ?? 0
  const tracked = row?.trackedSeconds ?? 0
  const total = rows.reduce((sum, r) => sum + r.activeSeconds, 0)
  const ranked = rows
    .filter((r) => r.activeSeconds > 0)
    .sort((a, b) => b.activeSeconds - a.activeSeconds)
  const index = row ? ranked.indexOf(row) : -1
  const activeHours = active / 3600
  const perActiveHour = (count: number) =>
    activeHours > 0 ? Math.round(count / activeHours) : null

  return {
    activeMinutes: active / 60,
    trackedMinutes: tracked / 60,
    activeShare: tracked > 0 && active > 0 ? active / tracked : null,
    days: row?.days ?? 0,
    weeks,
    weeklyMinutes: active / 60 / weeks,
    share: total > 0 ? active / total : 0,
    rank: index === -1 ? null : index + 1,
    rankedHours: ranked.length,
    keysPerActiveHour: perActiveHour(row?.keyboardKeys ?? 0),
    clicksPerActiveHour: perActiveHour(row?.mouseKeys ?? 0),
    busiest: index === 0,
  }
}
