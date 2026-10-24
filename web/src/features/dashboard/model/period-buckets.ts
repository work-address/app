import {
  addDays,
  addMonths,
  addWeeks,
  startOfMonth,
  startOfWeek,
} from 'date-fns'

import { fromDay, rangeLengthDays, toDay, type DateRange } from '@/shared'

export type BucketSize = 'day' | 'week' | 'month'

export type PeriodBucket = {
  /** The bucket's first day, `yyyy-MM-dd`. */
  key: string
  start: Date
  size: BucketSize
}

type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6

/**
 * How finely a period is drawn: days up to about six weeks, then weeks up to
 * half a year, then months - so a bar is never thinner than it can be read.
 */
export const bucketSizeFor = (
  range: Pick<DateRange, 'from' | 'to'>,
): BucketSize => {
  const days = rangeLengthDays(range)

  if (days <= 45) {
    return 'day'
  }

  return days <= 186 ? 'week' : 'month'
}

const bucketStart = (date: Date, size: BucketSize, weekStartsOn: WeekStart) =>
  size === 'day'
    ? date
    : size === 'week'
      ? startOfWeek(date, { weekStartsOn })
      : startOfMonth(date)

/** The bucket a day falls into. */
export const bucketKeyOf = (
  day: string,
  size: BucketSize,
  weekStartsOn: WeekStart,
) => toDay(bucketStart(fromDay(day), size, weekStartsOn))

/** Every bucket of the period, in order, empty ones included. */
export const periodBuckets = (
  range: Pick<DateRange, 'from' | 'to'>,
  weekStartsOn: WeekStart,
): PeriodBucket[] => {
  const size = bucketSizeFor(range)
  const last = fromDay(range.to)
  const step = size === 'day' ? addDays : size === 'week' ? addWeeks : addMonths
  const buckets: PeriodBucket[] = []

  for (
    let start = bucketStart(fromDay(range.from), size, weekStartsOn);
    start <= last;
    start = step(start, 1)
  ) {
    buckets.push({ key: toDay(start), start, size })
  }

  return buckets
}

/** A short axis label and a full tooltip title for a bucket. */
export const bucketLabels = (bucket: PeriodBucket, language: string) => {
  const short = new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
  })

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
