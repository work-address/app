import { ForbiddenError } from 'routing-controllers'

/**
 * Authorization failure: the caller is authenticated, but this data is not
 * theirs. 403, not 401 - a 401 tells a client its credentials are stale, so
 * clients spend a token refresh and a retry before failing anyway, and an
 * access denial is indistinguishable from an expired session. Use
 * AuthenticationException for genuinely unauthenticated requests.
 */
class AccessException extends ForbiddenError {
  public static NAME = 'UserAccessException'

  constructor(message: string = "The data can't be accessed by your user") {
    super(`Access error: ${message}`)

    Object.setPrototypeOf(this, AccessException.prototype)
    this.name = AccessException.NAME
    this.message = `Access error: ${message}`
  }
}

export default AccessException
