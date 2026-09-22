import { HttpError } from 'routing-controllers'

import { EIdentityRelayRefusal } from '@/model/identity'

/**
 * POST /user/identity/relay sent nothing. `errors[0].reason` says why, and
 * `errors[0].error` names the registry's own error when the chain would
 * have refused it. Every one of these is decided before the relayer spends
 * gas; none of them says anything about the holder's own transaction, which
 * stays available.
 *
 * A 429 carries `retryAfterSeconds`, which the error handler sends as
 * Retry-After.
 */
class IdentityRelayException extends HttpError {
  public static NAME = 'IdentityRelayException'

  public errors: {
    reason: EIdentityRelayRefusal
    error?: string | null
    retryAfterSeconds?: number
  }[]

  public retryAfterSeconds?: number

  constructor(
    httpCode: number,
    reason: EIdentityRelayRefusal,
    message: string,
    detail: { error?: string | null; retryAfterSeconds?: number } = {},
  ) {
    super(httpCode, message)

    Object.setPrototypeOf(this, IdentityRelayException.prototype)
    this.name = IdentityRelayException.NAME
    this.message = message
    this.errors = [{ reason, ...detail }]
    this.retryAfterSeconds = detail.retryAfterSeconds
  }
}

export default IdentityRelayException
