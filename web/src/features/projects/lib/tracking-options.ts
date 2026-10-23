/**
 * The project's recording policy as the form holds it, kept in step with the
 * server's rules (`ProjectManager`): titles and domains need apps, and the
 * review window is 1-24 whole hours. The form offers 1-12 of those.
 */
export const REVIEW_WINDOW_HOURS = { min: 1, max: 24 } as const
export const REVIEW_WINDOW_CHOICES = { min: 1, max: 12 } as const
export const DEFAULT_REVIEW_WINDOW_HOURS = REVIEW_WINDOW_CHOICES.max

export const isValidReviewWindowHours = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= REVIEW_WINDOW_HOURS.min &&
  value <= REVIEW_WINDOW_HOURS.max

/**
 * The hours the review window dropdown offers. A project saved with a longer
 * window keeps it as an extra choice, so editing something else does not
 * quietly shorten it.
 */
export const reviewWindowHourChoices = (current: unknown): number[] => {
  const hours = Array.from(
    { length: REVIEW_WINDOW_CHOICES.max - REVIEW_WINDOW_CHOICES.min + 1 },
    (_, index) => REVIEW_WINDOW_CHOICES.min + index,
  )
  return isValidReviewWindowHours(current) && !hours.includes(current)
    ? [...hours, current].sort((a, b) => a - b)
    : hours
}

type DetailPolicy = { trackWindowTitles: boolean; trackBrowserDomains: boolean }

/** What the server stores for the detail switches once apps are off. */
export const detailPolicyForApps = <T extends DetailPolicy>(
  values: T,
  apps: boolean,
): T =>
  apps
    ? values
    : { ...values, trackWindowTitles: false, trackBrowserDomains: false }
