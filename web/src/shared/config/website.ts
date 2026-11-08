const PRODUCTION_WEBSITE_ORIGIN = 'https://address.work'
const LOCAL_WEBSITE_ORIGIN = 'http://localhost:3000'

/**
 * Reads the origins out of a comma-separated setting. Anything that is not a
 * URL is dropped, so a typo can only ever narrow who may be returned to.
 */
export const parseWebsiteOrigins = (
  setting: string | undefined,
  isDev: boolean,
): readonly string[] => {
  const configured = (setting ?? '').split(',').flatMap((entry) => {
    try {
      return [new URL(entry.trim()).origin]
    } catch {
      return []
    }
  })

  if (configured.length > 0) {
    return configured
  }

  return isDev
    ? [PRODUCTION_WEBSITE_ORIGIN, LOCAL_WEBSITE_ORIGIN]
    : [PRODUCTION_WEBSITE_ORIGIN]
}

/** The websites a sign-in may send someone back to. */
export const WEBSITE_ORIGINS = parseWebsiteOrigins(
  import.meta.env.VITE_WEBSITE_ORIGINS,
  import.meta.env.DEV,
)
