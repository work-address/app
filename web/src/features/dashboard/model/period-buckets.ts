import {
  addDays,
  addHours,
  addMonths,
  addWeeks,
  startOfMonth,
  startOfWeek,
} from 'date-fns'

import { fromDay, rangeLengthDays, toDay, type DateRange } from '@/shared'

export type BucketSize = 'hour' | 'day' | 'week' | 'month'

export type PeriodBucket = {
  /** The bucket's first day, `yyyy-MM-dd`. */
  key: string
  start: Date
  size: BucketSize
}

type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6

/**
 * How finely a period is drawn: hours for a day or two, days up to about six
 * weeks, then weeks up to half a year, then months - so a chart is never a
 * single bar, and a bar is never thinner than it can be read.
 */
export const bucketSizeFor = (
  range: Pick<DateRange, 'from' | 'to'>,
): BucketSize => {
  const days = rangeLengthDays(range)

  if (days <= 2) {
    return 'hour'
  }

  if (days <= 45) {
    return 'day'
  }

  return days <= 186 ? 'week' : 'month'
}

const bucketStart = (date: Date, size: BucketSize, weekStartsOn: WeekStart) =>
  size === 'day' || size === 'hour'
    ? date
    : size === 'week'
      ? startOfWeek(date, { weekStartsOn })
      : startOfMonth(date)

const hourKey = (date: Date) =>
  `${toDay(date)}T${String(date.getHours()).padStart(2, '0')}`

/**
 * The bucket a key from `time/daily` falls into. Hour keys arrive already
 * as their bucket (`YYYY-MM-DDTHH`).
 */
export const bucketKeyOf = (
  day: string,
  size: BucketSize,
  weekStartsOn: WeekStart,
) =>
  size === 'hour'
    ? day
    : toDay(bucketStart(fromDay(day.slice(0, 10)), size, weekStartsOn))

/** Every bucket of the period, in order, empty ones included. */
export const periodBuckets = (
  range: Pick<DateRange, 'from' | 'to'>,
  weekStartsOn: WeekStart,
): PeriodBucket[] => {
  const size = bucketSizeFor(range)
  const buckets: PeriodBucket[] = []

  if (size === 'hour') {
    const end = addDays(fromDay(range.to), 1)

    for (
      let start = fromDay(range.from);
      start < end;
      start = addHours(start, 1)
    ) {
      buckets.push({ key: hourKey(start), start, size })
    }

    return buckets
  }

  const last = fromDay(range.to)
  const step = size === 'day' ? addDays : size === 'week' ? addWeeks : addMonths

  for (
    let start = bucketStart(fromDay(range.from), size, weekStartsOn);
    start <= last;
    start = step(start, 1)
  ) {
    buckets.push({ key: toDay(start), start, size })
  }

  return buckets
}

const WORKDAY_START = 8
const WORKDAY_END = 19

/**
 * Hour buckets trimmed to the working day - 8:00 to 19:00 - widened to any
 * hour with something in it, so a day is not mostly empty night. Other sizes
 * are returned as they are.
 */
export const visibleBuckets = (
  buckets: PeriodBucket[],
  withData: Set<string>,
): PeriodBucket[] => {
  if (buckets[0]?.size !== 'hour') {
    return buckets
  }

  const hours = buckets.map((bucket) => bucket.start.getHours())
  const keep = buckets.map(
    (bucket, index) =>
      withData.has(bucket.key) ||
      (hours[index] >= WORKDAY_START && hours[index] < WORKDAY_END),
  )
  const first = keep.indexOf(true)
  const last = keep.lastIndexOf(true)

  return first === -1 ? buckets : buckets.slice(first, last + 1)
}

/** A short axis label and a full tooltip title for a bucket. */
export const bucketLabels = (bucket: PeriodBucket, language: string) => {
  const short = new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
  })

  if (bucket.size === 'hour') {
    const hour = new Intl.DateTimeFormat(language, { hour: 'numeric' })

    return {
      label: hour.format(bucket.start),
      title: `${new Intl.DateTimeFormat(language, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(bucket.start)}, ${hour.format(bucket.start)}`,
    }
  }

  if (bucket.size === 'month') {
    return {
      label: new Intl.DateTimeFormat(language, { month: 'short' }).format(
        bucket.start,
      ),
      title: new Intl.DateTimeFormat(language, {
        month: 'long',
        year: 'numeric',
      }).format(bucket.start),
    }
  }

  if (bucket.size === 'week') {
    return {
      label: short.format(bucket.start),
      title: `${short.format(bucket.start)} – ${short.format(addDays(bucket.start, 6))}`,
    }
  }

  return {
    label: short.format(bucket.start),
    title: new Intl.DateTimeFormat(language, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(bucket.start),
  }
}
