import type { TimeActivityTone } from './types'
import type { Time } from '@/entities/time'

const MS_PER_MINUTE = 60_000

/**
 * Percentage boundaries between activity tones.
 *
 * Chosen so that at a ten-minute slot they reproduce the buckets the list
 * view already badges with (0-2 min red, 3-5 min orange, 6+ green), while
 * staying correct for a slot of any other length.
 */
const MEDIUM_TONE_FROM_PERCENT = 30
const HIGH_TONE_FROM_PERCENT = 60

/** A calendar day of tracked entries, with the totals its header reports. */
export type TimeDayGroup = {
  /** Local `YYYY-MM-DD`, the grouping key. */
  day: string
  /** Start of that day, for formatting in the reader's locale. */
  date: Date
  entries: Time[]
  trackedMinutes: number
  activeMinutes: number
  activityPercent: number
}

const toTimestamp = (value: string | undefined) => {
  if (!value) {
    return Number.NaN
  }

  return new Date(value).getTime()
}

/** Local calendar day of a timestamp - not the UTC one `toISOString` gives. */
const toDayKey = (date: Date) => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * The day an entry belongs to, or an empty string when it has no readable
 * start. Shared by the grid, which groups on it, and the list, which draws a
 * heading wherever it changes between rows.
 */
export const getTimeDayKey = (entry: Time): string => {
  const from = toTimestamp(entry.fromAt)

  return Number.isNaN(from) ? '' : toDayKey(new Date(from))
}

const toPercent = (part: number, whole: number) => {
  if (whole <= 0) {
    return 0
  }

  return Math.min(100, Math.max(0, Math.round((part / whole) * 100)))
}

/**
 * How long the slot covers, in minutes.
 *
 * Zero rather than a negative or NaN for a reversed or unparseable range, so
 * every caller downstream can treat the result as a plain non-negative number.
 */
export const getTimeSlotMinutes = (entry: Time): number => {
  const from = toTimestamp(entry.fromAt)
  const to = toTimestamp(entry.toAt)

  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) {
    return 0
  }

  return (to - from) / MS_PER_MINUTE
}

/** Share of the slot the tracker saw input for, 0-100. */
export const getTimeActivityPercent = (entry: Time): number =>
  toPercent(entry.minutesActive, getTimeSlotMinutes(entry))

export const getTimeActivityTone = (percent: number): TimeActivityTone => {
  if (percent < MEDIUM_TONE_FROM_PERCENT) {
    return 'low'
  }

  if (percent < HIGH_TONE_FROM_PERCENT) {
    return 'medium'
  }

  return 'high'
}

/**
 * Buckets the loaded feed into calendar days.
 *
 * Order is taken from the input rather than imposed here: the feed arrives in
 * whatever the active sort asked for, and the grid has to agree with the table
 * about what "first" means. Entries without a readable start are dropped - the
 * grid is organised by day, and an entry with no day has nowhere to sit.
 */
export const groupTimeByDay = (entries: Time[]): TimeDayGroup[] => {
  const groups: TimeDayGroup[] = []
  const byDay = new Map<string, TimeDayGroup>()

  for (const entry of entries) {
    const from = toTimestamp(entry.fromAt)

    if (Number.isNaN(from)) {
      continue
    }

    const date = new Date(from)
    const day = toDayKey(date)
    let group = byDay.get(day)

    if (!group) {
      group = {
        day,
        date: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        entries: [],
        trackedMinutes: 0,
        activeMinutes: 0,
        activityPercent: 0,
      }

      byDay.set(day, group)
      groups.push(group)
    }

    group.entries.push(entry)
    group.trackedMinutes += getTimeSlotMinutes(entry)
    group.activeMinutes += entry.minutesActive
  }

  for (const group of groups) {
    group.activityPercent = toPercent(group.activeMinutes, group.trackedMinutes)
  }

  return groups
}
