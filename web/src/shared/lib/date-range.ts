import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isValid,
  parse,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from 'date-fns'
import { enUS, es, ja, ru, zhCN } from 'date-fns/locale'

export const DATE_RANGE_PRESETS = [
  'today',
  'thisWeek',
  'lastWeek',
  'thisMonth',
  'lastMonth',
  'thisYear',
  'custom',
] as const

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number]

/** Calendar days in the reader's timezone, both ends included. */
export type DateRange = {
  preset: DateRangePreset
  from: string
  to: string
}

type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** The statistics API refuses longer ranges. */
export const MAX_RANGE_DAYS = 366

export const DEFAULT_DATE_RANGE_PRESET: Exclude<DateRangePreset, 'custom'> =
  'thisWeek'

const DAY_FORMAT = 'yyyy-MM-dd'

const LOCALES = { en: enUS, es, ja, ru, zh: zhCN } as const

/** The first day of the week where the reader's language is spoken. */
export const weekStartsOnFor = (language: string | undefined): WeekStart => {
  const code = language?.split('-')[0]?.toLowerCase() ?? 'en'
  const locale = LOCALES[code as keyof typeof LOCALES] ?? enUS

  return (locale.options?.weekStartsOn ?? 0) as WeekStart
}

export const toDay = (date: Date) => format(date, DAY_FORMAT)

export const fromDay = (day: string) => parse(day, DAY_FORMAT, new Date())

const bounds = (from: Date, to: Date) => ({ from: toDay(from), to: toDay(to) })

/**
 * The days a preset covers on `now`. Periods in progress end today rather than
 * at their natural end, so "this week" never reaches into days with nothing
 * tracked yet.
 */
export const resolveDateRange = (
  preset: Exclude<DateRangePreset, 'custom'>,
  now: Date,
  weekStartsOn: WeekStart,
): DateRange => {
  const week = startOfWeek(now, { weekStartsOn })

  switch (preset) {
    case 'today': {
      return { preset, ...bounds(now, now) }
    }
    case 'thisWeek': {
      return { preset, ...bounds(week, now) }
    }
    case 'lastWeek': {
      return { preset, ...bounds(subWeeks(week, 1), subDays(week, 1)) }
    }
    case 'thisMonth': {
      return { preset, ...bounds(startOfMonth(now), now) }
    }
    case 'lastMonth': {
      const month = subMonths(startOfMonth(now), 1)

      return { preset, ...bounds(month, endOfMonth(month)) }
    }
    case 'thisYear': {
      return { preset, ...bounds(startOfYear(now), now) }
    }
  }
}

export const rangeLengthDays = (range: Pick<DateRange, 'from' | 'to'>) =>
  differenceInCalendarDays(fromDay(range.to), fromDay(range.from)) + 1

/**
 * The period to compare against: the one before, over the same elapsed
 * stretch. On a Wednesday "this week" is Monday to Wednesday, and so is the
 * week it is compared with - a whole week would make every week in progress
 * look like a drop.
 */
export const previousDateRange = (range: DateRange): DateRange => {
  const from = fromDay(range.from)
  const to = fromDay(range.to)

  switch (range.preset) {
    case 'today': {
      return { ...range, ...bounds(subDays(from, 1), subDays(to, 1)) }
    }
    case 'thisWeek':
    case 'lastWeek': {
      return { ...range, ...bounds(subWeeks(from, 1), subWeeks(to, 1)) }
    }
    case 'thisMonth': {
      // date-fns clamps: the 31st compares with the last day of a shorter month.
      return { ...range, ...bounds(subMonths(from, 1), subMonths(to, 1)) }
    }
    case 'lastMonth': {
      const month = subMonths(from, 1)

      return { ...range, ...bounds(month, endOfMonth(month)) }
    }
    case 'thisYear': {
      return { ...range, ...bounds(subYears(from, 1), subYears(to, 1)) }
    }
    case 'custom': {
      const days = rangeLengthDays(range)

      return {
        ...range,
        ...bounds(subDays(from, days), subDays(to, days)),
      }
    }
  }
}

/** The API's form: `to` is the day after the last one, exclusive. */
export const toApiDateRange = (range: Pick<DateRange, 'from' | 'to'>) => ({
  from: range.from,
  to: toDay(addDays(fromDay(range.to), 1)),
})

const isDay = (value: string | null): value is string =>
  value != null &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  isValid(fromDay(value)) &&
  toDay(fromDay(value)) === value

/**
 * A range from URL days. A pair that matches a preset today reads as that
 * preset, so a shared "this week" link stays labelled as one; anything
 * malformed, reversed or too long falls back to the default.
 */
export const parseDateRange = (
  from: string | null,
  to: string | null,
  now: Date,
  weekStartsOn: WeekStart,
): DateRange => {
  const fallback = resolveDateRange(
    DEFAULT_DATE_RANGE_PRESET,
    now,
    weekStartsOn,
  )

  if (!isDay(from) || !isDay(to)) {
    return fallback
  }

  const days = rangeLengthDays({ from, to })

  if (days < 1 || days > MAX_RANGE_DAYS) {
    return fallback
  }

  for (const preset of DATE_RANGE_PRESETS) {
    if (preset === 'custom') {
      continue
    }

    const resolved = resolveDateRange(preset, now, weekStartsOn)

    if (resolved.from === from && resolved.to === to) {
      return resolved
    }
  }

  return { preset: 'custom', from, to }
}
