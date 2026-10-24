import { format, isValid, parse } from 'date-fns'

import {
  DEFAULT_TIME_SORT_FIELD,
  DEFAULT_TIME_SORT_ORDER,
  TIME_SORT_FIELDS,
  getTimeSortField,
  getTimeSortOrder,
  toTimeSort,
  type TimeSortField,
} from './time-sort'

import type { TimeFilters, TimeSort } from '@/entities/time'

const DAY_FORMAT = 'yyyy-MM-dd'

// The search rejects a project id that is not a UUID, which would turn a
// mistyped link into a failed page instead of the unfiltered feed.
const UUID = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i

/**
 * URL parameter for each numeric filter.
 *
 * `from`, `to` and `projects` are left out: they are the names the dashboard
 * shares, so a link from a widget lands on the same entries.
 */
const RANGE_PARAMS = {
  timeActiveMin: 'activeMin',
  timeActiveMax: 'activeMax',
  keyboardKeysMin: 'keysMin',
  keyboardKeysMax: 'keysMax',
  mouseKeysMin: 'clicksMin',
  mouseKeysMax: 'clicksMax',
  mouseDistanceMin: 'distanceMin',
  mouseDistanceMax: 'distanceMax',
} as const satisfies Partial<Record<keyof TimeFilters, string>>

type RangeFilter = keyof typeof RANGE_PARAMS

const readDay = (value: string | null) => {
  if (!value) {
    return
  }

  // Parsed in the reader's timezone: a day in the URL is the day they picked,
  // the same midnight the date picker produces.
  const date = parse(value, DAY_FORMAT, new Date())

  return isValid(date) ? date.getTime() : undefined
}

const readNumber = (value: string | null) => {
  if (value == null || value.trim() === '') {
    return
  }

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : undefined
}

const isSortField = (value: string | null): value is TimeSortField =>
  TIME_SORT_FIELDS.some((entry) => entry.field === value)

/**
 * The worklog filters and sort a URL describes. Anything unknown or malformed
 * is dropped rather than failing the page.
 */
export const parseTimeSearch = (
  search: URLSearchParams,
): { filters: Partial<TimeFilters>; sort: TimeSort } => {
  const filters: Partial<TimeFilters> = {}

  const fromAt = readDay(search.get('from'))
  const toAt = readDay(search.get('to'))
  // The worklogs filter one project; the dashboard's list form is accepted so
  // its links still open, narrowed to the first.
  const project = search.get('projects')?.split(',')[0]?.trim()
  const note = search.get('note')?.trim()

  if (fromAt != null) {
    filters.fromAt = fromAt
  }
  if (toAt != null) {
    filters.toAt = toAt
  }
  if (project && UUID.test(project)) {
    filters.activityId = project
  }
  if (note) {
    filters.note = note
  }

  for (const key of Object.keys(RANGE_PARAMS) as RangeFilter[]) {
    const value = readNumber(search.get(RANGE_PARAMS[key]))

    if (value != null) {
      filters[key] = value
    }
  }

  const field = search.get('sort')
  const order = search.get('order')?.toUpperCase()

  const sort = toTimeSort(
    isSortField(field) ? field : DEFAULT_TIME_SORT_FIELD,
    order === 'ASC' || order === 'DESC' ? order : DEFAULT_TIME_SORT_ORDER,
  )

  return { filters, sort }
}

/** The URL for a set of filters and a sort; defaults are left out. */
export const toTimeSearch = (
  filters: Partial<TimeFilters>,
  sort: TimeSort,
): URLSearchParams => {
  const search = new URLSearchParams()

  if (filters.fromAt != null) {
    search.set('from', format(filters.fromAt, DAY_FORMAT))
  }
  if (filters.toAt != null) {
    search.set('to', format(filters.toAt, DAY_FORMAT))
  }
  if (filters.activityId) {
    search.set('projects', filters.activityId)
  }
  if (filters.note) {
    search.set('note', filters.note)
  }

  for (const key of Object.keys(RANGE_PARAMS) as RangeFilter[]) {
    const value = filters[key]

    if (value != null && String(value) !== '') {
      search.set(RANGE_PARAMS[key], String(value))
    }
  }

  const field = getTimeSortField(sort)
  const order = getTimeSortOrder(sort)

  if (field !== DEFAULT_TIME_SORT_FIELD || order !== DEFAULT_TIME_SORT_ORDER) {
    search.set('sort', field)
    search.set('order', order.toLowerCase())
  }

  return search
}
