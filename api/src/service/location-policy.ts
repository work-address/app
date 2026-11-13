import moment from 'moment'

import { Project } from '@/entity/project'
import { TimeCreateDto } from '@/model/dto/time'

export interface LocationRow {
  at: Date
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  mock: boolean
}

/** What an upload's location becomes: the entry's status and the points kept. */
export interface LocationResult {
  status: string | null
  rows: LocationRow[]
}

/** Nothing about location: a desktop entry. */
export const NO_LOCATION: LocationResult = { status: null, rows: [] }

const INVALID: LocationResult = { status: 'invalid', rows: [] }

/** What a phone may say of a slice. Only `ok` carries points. */
const PHONE_STATUSES = new Set([
  'ok',
  'off',
  'permission_missing',
  'unsupported',
  'error',
])

/** One a minute over a ten-minute slice, with room for a slice that ran long. */
const MAX_POINTS = 30

/** How far outside its slice a fix may be taken, for clocks that disagree. */
const SLACK_MS = 60_000

/**
 * Reads the location a phone sent with one slice. Like app usage, what cannot
 * be read is kept as `invalid` and never costs the time. Points are stored only
 * while the project asks for location, whatever the phone sends.
 */
export class LocationPolicy {
  public static normalize(
    input: TimeCreateDto,
    project: Project,
  ): LocationResult {
    if (!project.trackLocation) return { status: 'off', rows: [] }
    const { locationStatus: status, locations } = input
    if (status === undefined && locations === undefined) return NO_LOCATION
    if (typeof status !== 'string' || !PHONE_STATUSES.has(status))
      return INVALID
    const points = locations ?? []
    if (!Array.isArray(points) || points.length > MAX_POINTS) return INVALID
    if (status !== 'ok' && points.length > 0) return INVALID
    const window = {
      from: moment(input.fromAt).valueOf() - SLACK_MS,
      to: moment(input.toAt).valueOf() + SLACK_MS,
    }
    const rows: LocationRow[] = []
    for (const value of points) {
      const row = this.point(value, window)
      if (!row) return INVALID
      rows.push(row)
    }
    rows.sort((a, b) => a.at.getTime() - b.at.getTime())
    return { status, rows }
  }

  /** One fix, or one attempt with none; null if it cannot be read. */
  private static point(
    value: unknown,
    window: { from: number; to: number },
  ): LocationRow | null {
    if (!value || typeof value !== 'object') return null
    const point = value as Record<string, unknown>
    if (typeof point.at !== 'string') return null
    // Parsed as `fromAt` is, so a phone's zone-less UTC reads the same way.
    const at = moment(point.at, moment.ISO_8601, true)
    if (!at.isValid() || at.valueOf() < window.from || at.valueOf() > window.to)
      return null
    const mock = point.mock ?? false
    if (typeof mock !== 'boolean') return null
    const { latitude, longitude, accuracy } = point
    if (latitude === null && longitude === null && accuracy === null)
      return { at: at.toDate(), latitude, longitude, accuracy, mock }
    if (
      !this.isWithin(latitude, -90, 90) ||
      !this.isWithin(longitude, -180, 180) ||
      !(accuracy === null || this.isWithin(accuracy, 0, 1_000_000))
    )
      return null
    return { at: at.toDate(), latitude, longitude, accuracy, mock }
  }

  private static isWithin(
    value: unknown,
    min: number,
    max: number,
  ): value is number {
    return (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= min &&
      value <= max
    )
  }
}
