import { HttpError } from 'routing-controllers'

/**
 * A write that would change which invoice bills an entry, or whether a
 * billed entry is paid, outside that invoice. 409: the request is well
 * formed, but the entry's current state - it is on an invoice - forbids it.
 */
class InvoicedTimeException extends HttpError {
  public static NAME = 'InvoicedTimeException'

  constructor(message: string) {
    super(409, message)

    Object.setPrototypeOf(this, InvoicedTimeException.prototype)
    this.name = InvoicedTimeException.NAME
    this.message = message
  }
}

export default InvoicedTimeException
