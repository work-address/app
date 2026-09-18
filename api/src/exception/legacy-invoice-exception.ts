import { HttpError } from 'routing-controllers'

/**
 * A request that needs an invoice's financial snapshot, made of an invoice
 * issued before invoices kept one. 409: the request is well formed, but this
 * invoice never recorded the rate and lines it was raised from, and filling
 * them in from today's project would describe a bill nobody agreed to.
 */
class LegacyInvoiceException extends HttpError {
  public static NAME = 'LegacyInvoiceException'

  constructor(message: string) {
    super(409, message)

    Object.setPrototypeOf(this, LegacyInvoiceException.prototype)
    this.name = LegacyInvoiceException.NAME
    this.message = message
  }
}

export default LegacyInvoiceException
