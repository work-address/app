import AuthenticationException from '@/exception/authentication-exception'

/**
 * Raised when a Google email is already an account's address under another
 * Google subject: a reassigned mailbox doesn't inherit its last holder's
 * account. Named so the sign-in page can say so, rather than "try again".
 */
class GoogleEmailTakenException extends AuthenticationException {
  public static NAME = 'GoogleEmailTakenException'

  constructor() {
    super('This email already belongs to another account')

    Object.setPrototypeOf(this, GoogleEmailTakenException.prototype)
    this.name = GoogleEmailTakenException.NAME
  }
}

export default GoogleEmailTakenException
