/** One position a phone recorded, or one attempt that found none. */
export type TrailPoint = {
  at: string
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  mock: boolean
}

export type TrailFix = TrailPoint & { latitude: number; longitude: number }

/** A line between two fixes in time order; unknown where no fix lies between. */
export type TrailLeg = { from: TrailFix; to: TrailFix; known: boolean }

/**
 * Fixes further apart than this leave a stretch nobody recorded: a phone takes
 * one a minute at most, so ten minutes is a whole slice without one.
 */
export const TRAIL_GAP_MS = 10 * 60_000

export const isFix = (point: TrailPoint): point is TrailFix =>
  point.latitude !== null && point.longitude !== null

const inTimeOrder = (points: readonly TrailPoint[]) =>
  [...points].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))

/** Whether there is anything to draw. */
export const hasFix = (points?: readonly TrailPoint[] | null): boolean =>
  Boolean(points?.some(isFix))

/** Whether the phone said any fix here was not real. */
export const mayBeFaked = (points?: readonly TrailPoint[] | null): boolean =>
  Boolean(points?.some((point) => isFix(point) && point.mock))

export const trailFixes = (points: readonly TrailPoint[]): TrailFix[] =>
  inTimeOrder(points).filter(isFix)

/**
 * The fixes joined in time order. A leg is unknown, and drawn dashed, where
 * an attempt between its ends found no fix or nothing was recorded for long.
 */
export const trailLegs = (points: readonly TrailPoint[]): TrailLeg[] => {
  const legs: TrailLeg[] = []
  let last: TrailFix | null = null
  let missed = false

  for (const point of inTimeOrder(points)) {
    if (!isFix(point)) {
      missed = last !== null
      continue
    }
    if (last) {
      const gap = Date.parse(point.at) - Date.parse(last.at)
      legs.push({
        from: last,
        to: point,
        known: !missed && gap <= TRAIL_GAP_MS,
      })
    }
    last = point
    missed = false
  }

  return legs
}
