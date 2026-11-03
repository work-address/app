import { HttpError } from 'routing-controllers'

/**
 * Raised when this server can't fetch Google's signing keys, so a credential
 * can't be checked at all. The credential may be fine, so it isn't refused.
 */
class GoogleUnavailableException extends HttpError {
  public static NAME = 'GoogleUnavailableException'

  constructor() {
    super(503, 'Google sign-in is unavailable')

    Object.setPrototypeOf(this, GoogleUnavailableException.prototype)
    this.name = GoogleUnavailableException.NAME
  }
}

export default GoogleUnavailableException
