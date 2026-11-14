import { describe, expect, it } from 'vitest'

import { getTimeLocations } from './time-locations'

import type { Time } from '@/entities/time'
import type { TrailPoint } from '@/shared'

const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 10, day, hour, minute).toISOString()

const fix = (day: number, hour: number, minute: number): TrailPoint => ({
  at: at(day, hour, minute),
  latitude: 52 + minute / 1000,
  longitude: 4 + minute / 1000,
  accuracy: 10,
  mock: false,
})

const noFix = (day: number, hour: number, minute: number): TrailPoint => ({
  ...fix(day, hour, minute),
  latitude: null,
  longitude: null,
  accuracy: null,
})

const entry = (
  id: string,
  user: string,
  day: number,
  hour: number,
  locations?: TrailPoint[],
) =>
  ({
    id,
    user: { id: user },
    fromAt: at(day, hour),
    toAt: at(day, hour, 10),
    source: 'mobile',
    locations,
  }) as unknown as Time

describe('getTimeLocations', () => {
  it('keeps only entries with a fix, oldest first', () => {
    const { entries } = getTimeLocations([
      entry('late', 'ann', 14, 11, [fix(14, 11, 2)]),
      // Held back by the server: under review, expired, or a viewer reading.
      entry('held', 'ann', 14, 10),
      entry('blind', 'ann', 14, 9, [noFix(14, 9, 1)]),
      entry('early', 'ann', 14, 8, [fix(14, 8, 1)]),
    ])

    expect(entries.map(({ id }) => id)).toEqual(['early', 'late'])
  })

  it('draws one trail per person per day, never joining two phones', () => {
    const { trails } = getTimeLocations([
      entry('a1', 'ann', 14, 9, [fix(14, 9, 1), fix(14, 9, 5)]),
      entry('b1', 'bob', 14, 9, [fix(14, 9, 2)]),
      entry('a2', 'ann', 14, 15, [fix(14, 15, 3)]),
      entry('a3', 'ann', 15, 9, [fix(15, 9, 4)]),
    ])

    expect(trails.map((trail) => trail.map((point) => point.at))).toEqual([
      [at(14, 9, 1), at(14, 9, 5), at(14, 15, 3)],
      [at(14, 9, 2)],
      [at(15, 9, 4)],
    ])
  })

  it('finds the entry a clicked point came from', () => {
    const point = fix(14, 9, 3)
    const { entryOf } = getTimeLocations([
      entry('a', 'ann', 14, 9, [fix(14, 9, 1), point]),
      entry('b', 'ann', 14, 10, [fix(14, 10, 1)]),
    ])

    expect(entryOf.get(point)?.id).toBe('a')
    // By identity: an equal point from elsewhere is not one of the map's.
    expect(entryOf.get({ ...point })).toBeUndefined()
  })
})
