import { HttpError } from 'routing-controllers'

import { EIdentityRefusal } from '@/model/identity'

/**
 * A presentation, or the export sent with it, that cannot be accepted
 * whatever the chain says: malformed, a proof that does not open, the wrong
 * registry, an account IdentityRegistry cannot hold. 422: the request is
 * well formed JSON, but the document in it is not one this service can
 * anchor. `errors[0].reason` names the check that failed.
 */
class IdentityPresentationException extends HttpError {
  public static NAME = 'IdentityPresentationException'

  public errors: { reason: EIdentityRefusal }[]

  constructor(reason: EIdentityRefusal, message: string) {
    super(422, message)

    Object.setPrototypeOf(this, IdentityPresentationException.prototype)
    this.name = IdentityPresentationException.NAME
    this.message = message
    this.errors = [{ reason }]
  }
}

export default IdentityPresentationException
