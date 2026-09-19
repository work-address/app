import { HttpError } from 'routing-controllers'

import { EIdentityUnavailable } from '@/model/identity'

/**
 * The chain could not be asked: anchoring is not configured here, the RPC
 * endpoint failed, or it answers as another chain. 503, and never a 422:
 * nothing is known to be wrong with the presentation, so a client must not
 * report it as a failed proof. `errors[0].reason` says which.
 */
class IdentityUnavailableException extends HttpError {
  public static NAME = 'IdentityUnavailableException'

  public errors: { reason: EIdentityUnavailable }[]

  constructor(reason: EIdentityUnavailable, message: string) {
    super(503, message)

    Object.setPrototypeOf(this, IdentityUnavailableException.prototype)
    this.name = IdentityUnavailableException.NAME
    this.message = message
    this.errors = [{ reason }]
  }
}

export default IdentityUnavailableException
