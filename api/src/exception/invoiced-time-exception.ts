import { BadRequestError } from 'routing-controllers'

/**
 * Raised when a change would drive an entry apart from the invoice that bills
 * it. `Invoice` owns `isPaid` for such an entry: mark the invoice instead.
 */
class InvoicedTimeException extends BadRequestError {
  public static NAME = 'InvoicedTimeException'

  constructor(
    message: string = 'This time is on an invoice: change the invoice instead',
  ) {
    super(message)

    Object.setPrototypeOf(this, InvoicedTimeException.prototype)
    this.name = InvoicedTimeException.NAME
  }
}

export default InvoicedTimeException
