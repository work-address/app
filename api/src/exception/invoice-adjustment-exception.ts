import { HttpError } from 'routing-controllers'

/**
 * An adjustment asked of an invoice that hours cannot correct. 409: the
 * request is well formed and the caller may be its issuer, but this invoice
 * bills an agreed sum rather than tracked time, so there are no hours it
 * could have missed - and a different sum is a new agreement, which only the
 * marketplace's signed call can raise.
 */
class InvoiceAdjustmentException extends HttpError {
  public static NAME = 'InvoiceAdjustmentException'

  constructor(message: string) {
    super(409, message)

    Object.setPrototypeOf(this, InvoiceAdjustmentException.prototype)
    this.name = InvoiceAdjustmentException.NAME
    this.message = message
  }
}

export default InvoiceAdjustmentException
