import { isAxiosError } from 'axios'

/**
 * Why a record did not load, as far as the page needs to know: it is not
 * there (a wrong or stale link, so a reload will not help), or the request
 * failed (worth a retry).
 */
export type LoadFailureKind = 'not-found' | 'failed'

export function getLoadFailureKind(error: unknown): LoadFailureKind {
  if (isAxiosError(error)) {
    return error.response?.status === 404 ? 'not-found' : 'failed'
  }

  // What usually arrives: the generated client hands back the response body,
  // `{ name, message }`, and the API names a missing record NotFoundError.
  if (
    error !== null &&
    typeof error === 'object' &&
    'name' in error &&
    error.name === 'NotFoundError'
  ) {
    return 'not-found'
  }

  return 'failed'
}

const UUID_PATTERN = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i

/**
 * Record ids are UUIDs. Anything else cannot name a record, so the page can
 * say "not found" without asking - the API answers a malformed id with a 500
 * rather than a 404, which would otherwise read as an outage.
 */
export function isRecordId(value?: string): value is string {
  return Boolean(value && UUID_PATTERN.test(value))
}
