/** A moment as the reader's wall clock shows it. */
export interface ZonedParts {
  /** `YYYY-MM-DD` */
  day: string
  /** ISO weekday: 1 is Monday. */
  weekday: number
  hour: number
  minute: number
  second: number
}

const WEEKDAYS: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
}

const formatters = new Map<string, Intl.DateTimeFormat>()

const formatter = (timeZone: string) => {
  let format = formatters.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    })
    formatters.set(timeZone, format)
  }
  return format
}

/**
 * Wall-clock parts in an IANA timezone, with nothing but `Intl` - so the same
 * code runs in the API and in the browser.
 */
export function zonedParts(at: number | Date, timeZone: string): ZonedParts {
  const parts: Record<string, string> = {}
  for (const part of formatter(timeZone).formatToParts(new Date(at)))
    parts[part.type] = part.value
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAYS[parts.weekday] ?? 1,
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

/** The first instant after `at` that is midnight on the reader's clock. */
export function nextMidnight(at: number, timeZone: string): number {
  const { hour, minute, second } = zonedParts(at, timeZone)
  const elapsed = ((hour * 60 + minute) * 60 + second) * 1000 + (at % 1000)
  let next = at - elapsed + 24 * 3600_000
  // A day with a clock change is 23 or 25 hours long: step to the real
  // midnight rather than an hour either side of it.
  for (let i = 0; i < 2; i++) {
    const parts = zonedParts(next, timeZone)
    if (parts.hour === 0 && parts.minute === 0) break
    next += parts.hour >= 12 ? 3600_000 : -3600_000
  }
  return next
}
