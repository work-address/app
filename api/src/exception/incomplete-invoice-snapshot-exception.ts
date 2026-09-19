import { HttpError } from 'routing-controllers'

/**
 * A request that needs an invoice's InvoiceRecord, made of an invoice whose
 * v1 snapshot lacks a field the record carries - its issuer, say, on a row
 * whose `userId` is empty. 409: the request is well formed, but this invoice
 * cannot produce its record, and filling the gap from today's project or
 * users would describe a bill nobody agreed to.
 */
class IncompleteInvoiceSnapshotException extends HttpError {
  public static NAME = 'IncompleteInvoiceSnapshotException'

  constructor(message: string) {
    super(409, message)

    Object.setPrototypeOf(this, IncompleteInvoiceSnapshotException.prototype)
    this.name = IncompleteInvoiceSnapshotException.NAME
    this.message = message
  }
}

export default IncompleteInvoiceSnapshotException
