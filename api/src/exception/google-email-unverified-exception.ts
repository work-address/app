import AuthenticationException from '@/exception/authentication-exception'

/**
 * Raised when Google hasn't verified the account's email. Named because the
 * way out is at Google, so trying again here would never help.
 */
class GoogleEmailUnverifiedException extends AuthenticationException {
  public static NAME = 'GoogleEmailUnverifiedException'

  constructor() {
    super('Google account email is not verified')

    Object.setPrototypeOf(this, GoogleEmailUnverifiedException.prototype)
    this.name = GoogleEmailUnverifiedException.NAME
  }
}

export default GoogleEmailUnverifiedException
