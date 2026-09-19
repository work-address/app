import { HttpError } from 'routing-controllers'

import { IIdentityChainCheck } from '@/model/identity'

/**
 * A valid presentation that is not the subject's current version on chain:
 * unpublished, superseded, withdrawn, or a different commitment or schema
 * at that version. 409: the document is sound, but the registry's state
 * forbids hosting it as the current profile. `errors[0]` carries the chain's
 * answer.
 */
class IdentityChainStateException extends HttpError {
  public static NAME = 'IdentityChainStateException'

  public errors: IIdentityChainCheck[]

  constructor(check: IIdentityChainCheck, message: string) {
    super(409, message)

    Object.setPrototypeOf(this, IdentityChainStateException.prototype)
    this.name = IdentityChainStateException.NAME
    this.message = message
    this.errors = [{ ...check }]
  }
}

export default IdentityChainStateException
