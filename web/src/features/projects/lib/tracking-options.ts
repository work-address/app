/**
 * The project's recording policy as the form holds it, kept in step with the
 * server's rules (`ProjectManager`): titles and domains need apps, the review
 * window is 1-24 whole hours, retention is 1-3650 whole days or unset.
 */
export const REVIEW_WINDOW_HOURS = { min: 1, max: 24 } as const
export const SCREENSHOT_RETENTION_DAYS = { min: 1, max: 3650 } as const

/** A blank field is `null`; digits are the number; anything else is `NaN`. */
export const readWholeNumber = (text: string): number | null => {
  const trimmed = text.trim()
  if (!trimmed) {
    return null
  }
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN
}

const within = (
  value: unknown,
  range: { readonly min: number; readonly max: number },
): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= range.min &&
  value <= range.max

export const isValidReviewWindowHours = (value: unknown): boolean =>
  within(value, REVIEW_WINDOW_HOURS)

export const isValidScreenshotRetentionDays = (value: unknown): boolean =>
  value == null || within(value, SCREENSHOT_RETENTION_DAYS)

type DetailPolicy = { trackWindowTitles: boolean; trackBrowserDomains: boolean }

/** What the server stores for the detail switches once apps are off. */
export const detailPolicyForApps = <T extends DetailPolicy>(
  values: T,
  apps: boolean,
): T =>
  apps
    ? values
    : { ...values, trackWindowTitles: false, trackBrowserDomains: false }
