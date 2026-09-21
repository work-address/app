import { HttpError } from 'routing-controllers'

/**
 * A milestone pushed again under a reference already billed, but naming a
 * different contract, freelancer or sum. 409: the reference is the
 * idempotency key, so a repeat is answered with the first invoice only when
 * it is the same bill. Answering a different one with the first invoice's id
 * would tell the marketplace that a sum was billed which never was.
 */
class InvoiceMilestoneException extends HttpError {
  public static NAME = 'InvoiceMilestoneException'

  constructor(message: string) {
    super(409, message)

    Object.setPrototypeOf(this, InvoiceMilestoneException.prototype)
    this.name = InvoiceMilestoneException.NAME
    this.message = message
  }
}

export default InvoiceMilestoneException
