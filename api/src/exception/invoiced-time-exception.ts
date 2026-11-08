import { BadRequestError } from 'routing-controllers'

/**
 * Raised when a change would take detail away from an invoice's record. The
 * detail stays until the invoice is rejected; the paid state may still change.
 */
class InvoicedTimeException extends BadRequestError {
  public static NAME = 'InvoicedTimeException'

  constructor(
    message: string = 'This time is on an invoice, so its detail stays unless the invoice is rejected',
  ) {
    super(message)

    Object.setPrototypeOf(this, InvoicedTimeException.prototype)
    this.name = InvoicedTimeException.NAME
  }
}

export default InvoicedTimeException
