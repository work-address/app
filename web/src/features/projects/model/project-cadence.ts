import type { baseApi } from '@/shared'

/** The cadence as `GET /project/:id/cadence` answers it. */
export type ProjectCadenceView =
  baseApi.ProjectControllerReadCadenceResponses[200]

export type ProjectCadenceVersion = ProjectCadenceView['versions'][number]

/**
 * What the drawer draws.
 *
 * `off` is a project whose owner has never stated a cadence, and is the state
 * every project starts in - nothing is invoiced automatically until somebody
 * says how. `scheduled` is a stated cadence with a next cutoff to show.
 */
export type ProjectCadenceState = 'off' | 'scheduled'

/** Where one reader stands on automatic issuance of their own hours. */
export type ProjectCadenceConsent = 'unanswered' | 'consented' | 'declined'

/**
 * The days of the week as the API numbers them: 0 is Sunday, matching
 * `Date.prototype.getDay` and moment's `day()`. Listed rather than derived so
 * the translation key for each day exists in the locale files and can be
 * found by grepping for it.
 */
export const CADENCE_WEEKDAY_KEYS = [
  'project.cadence.weekday.sunday',
  'project.cadence.weekday.monday',
  'project.cadence.weekday.tuesday',
  'project.cadence.weekday.wednesday',
  'project.cadence.weekday.thursday',
  'project.cadence.weekday.friday',
  'project.cadence.weekday.saturday',
] as const

/** The translation key naming `weekday`, or null when it is not a weekday. */
export const cadenceWeekdayKey = (weekday: number): string | null =>
  CADENCE_WEEKDAY_KEYS[weekday] ?? null

export const projectCadenceState = (
  view: ProjectCadenceView | null,
): ProjectCadenceState =>
  view?.current && view.nextCutoff ? 'scheduled' : 'off'

/**
 * The reader's own answer. `null` from the API means they have never been
 * asked, which is not the same as having said no - nobody is enrolled by
 * default, and the difference is what the drawer prompts on.
 */
export const projectCadenceConsent = (
  view: ProjectCadenceView | null,
): ProjectCadenceConsent => {
  if (view?.consented === true) {
    return 'consented'
  }

  return view?.consented === false ? 'declined' : 'unanswered'
}

/**
 * The next cutoff as an instant, or null when there is no cadence.
 *
 * The API sends a UTC instant, never a local reading, precisely because the
 * cadence's own zone and the reader's may differ: the drawer shows both, and
 * this is the value both are formatted from.
 */
export const projectCadenceNextCutoff = (
  view: ProjectCadenceView | null,
): Date | null => {
  if (!view?.nextCutoff) {
    return null
  }

  const cutoff = new Date(view.nextCutoff)

  return Number.isNaN(cutoff.getTime()) ? null : cutoff
}

/** The same, for the instant the period's invoice is issued. */
export const projectCadenceNextIssue = (
  view: ProjectCadenceView | null,
): Date | null => {
  if (!view?.nextIssueAt) {
    return null
  }

  const issueAt = new Date(view.nextIssueAt)

  return Number.isNaN(issueAt.getTime()) ? null : issueAt
}

/**
 * The cutoff written as the cadence's own zone reads it - "Monday 09:00" -
 * which is the rule people agreed to, not the instant it happens to be here.
 *
 * Taken from the instant rather than from `cutoffLocal`, so a week whose
 * clocks changed still prints the day the cutoff actually falls on.
 */
export const projectCadenceLocalReading = (
  view: ProjectCadenceView | null,
): { weekdayKey: string | null; time: string } | null => {
  const cutoff = projectCadenceNextCutoff(view)
  const timezone = view?.current?.timezone

  if (!cutoff || !timezone) {
    return null
  }

  // A fixed 24-hour locale, because the reading is the rule, not prose: the
  // day name comes back as a translation key and the clock as `HH:mm`.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(cutoff)

  const at = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return {
    weekdayKey: cadenceWeekdayKey(cadenceWeekdayIndex(cutoff, timezone)),
    time: `${at('hour')}:${at('minute')}`,
  }
}

/**
 * Which day of the week an instant falls on in a named zone, numbered as the
 * API numbers weekdays.
 *
 * `Intl` will not hand over a number, and a name would have to be matched
 * against a locale's spelling, so the day is read in the en-US calendar and
 * looked up - the one list of English day names in this file.
 */
export const cadenceWeekdayIndex = (at: Date, timezone: string): number => {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
  }).format(at)

  return EN_WEEKDAYS.indexOf(weekday)
}

const EN_WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

/** Whether to offer the editor: the owner states the rule, nobody else. */
export const canEditProjectCadence = (
  view: ProjectCadenceView | null,
): boolean => view?.canEdit === true

/**
 * The zones the owner can choose from, as select options.
 *
 * `Intl.supportedValuesOf` is the browser's own IANA list; where it is
 * missing - an older engine, or a test environment - the list falls back to
 * whatever is already in use plus UTC, so the field still shows the truth
 * about this project rather than an empty menu.
 */
export const cadenceTimezoneOptions = (
  current: string,
): { value: string; label: string }[] => {
  const supported =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : []

  const zones = supported.length > 0 ? supported : ['UTC']
  const withCurrent = zones.includes(current) ? zones : [current, ...zones]

  return withCurrent.map((zone) => ({ value: zone, label: zone }))
}
