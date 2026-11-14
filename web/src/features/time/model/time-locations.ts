import { getTimeDayKey } from './time-grid'

import type { Time } from '@/entities/time'

import { hasFix, type TrailPoint } from '@/shared'

export type TimeLocations = {
  /** The entries with a fix, oldest first: the dialog steps through these. */
  entries: Time[]
  /** One trail per person per day, so no line joins two phones or nights. */
  trails: TrailPoint[][]
  /** Which entry a point came from, by the point itself. */
  entryOf: Map<TrailPoint, Time>
}

const toTimestamp = (value: Time['fromAt']) => new Date(value ?? '').getTime()

/**
 * Where the phones were among some entries, ready for one map. Entries the
 * reader may not see the detail of come without fixes and are left out.
 */
export const getTimeLocations = (entries: readonly Time[]): TimeLocations => {
  const located = entries
    .filter((entry) => hasFix(entry.locations))
    .sort((a, b) => toTimestamp(a.fromAt) - toTimestamp(b.fromAt))
  const trails = new Map<string, TrailPoint[]>()
  const entryOf = new Map<TrailPoint, Time>()

  for (const entry of located) {
    const key = `${entry.user?.id ?? ''} ${getTimeDayKey(entry)}`
    const trail = trails.get(key) ?? []
    for (const point of entry.locations ?? []) {
      trail.push(point)
      entryOf.set(point, entry)
    }
    trails.set(key, trail)
  }

  return { entries: located, trails: [...trails.values()], entryOf }
}
