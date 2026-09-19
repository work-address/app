import { HttpError } from 'routing-controllers'

/**
 * A request that conflicts with an invoice's escrow binding: submitting an
 * invoice to a second allocation, billing an allocation that already bills
 * another invoice, submitting one already paid, or marking an escrow-bound
 * invoice paid by hand. 409: the request is well formed, but what the
 * invoice is already bound to forbids it.
 */
class InvoiceEscrowException extends HttpError {
  public static NAME = 'InvoiceEscrowException'

  constructor(message: string) {
    super(409, message)

    Object.setPrototypeOf(this, InvoiceEscrowException.prototype)
    this.name = InvoiceEscrowException.NAME
    this.message = message
  }
}

export default InvoiceEscrowException
