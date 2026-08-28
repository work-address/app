import { injectable } from 'inversify'

import { Invoice } from '@/entity/invoice'

/** Bump when the field list or their order changes. */
export const INVOICE_RECORD_VERSION = 1

/**
 * Canonical serialisation of a paid invoice.
 *
 * Nothing hashes this yet. It exists now because the format has to be
 * deterministic from the first paid invoice onwards: get it right and every
 * historical record stays verifiable when something does hash it; get it late
 * and the back catalogue is stranded on the day that happens.
 *
 * Rules, all load-bearing:
 *  - keys emitted in a fixed order, never `JSON.stringify` over an object
 *    whose key order depends on how it was built
 *  - integers only, in cents - no floats, whose text form varies by platform
 *  - timestamps as ISO-8601 in UTC with milliseconds, never locale-dependent
 *  - an explicit version, so the shape can change without invalidating what
 *    was written under the old one
 */
@injectable()
export class InvoiceRecord {
  public serialise(invoice: Invoice): string {
    const fields: [string, string | number][] = [
      ['version', INVOICE_RECORD_VERSION],
      ['invoiceId', invoice.id],
      ['projectId', invoice.project.id],
      ['issuerAddress', (invoice.user?.address ?? '').toLowerCase()],
      ['ownerAddress', invoice.project.user.address.toLowerCase()],
      ['periodStart', InvoiceRecord.timestamp(invoice.fromAt)],
      ['periodEnd', InvoiceRecord.timestamp(invoice.toAt)],
      ['amountCents', Math.trunc(invoice.amountCents)],
      ['paidAt', InvoiceRecord.timestamp(invoice.paidAt ?? new Date(0))],
    ]

    // Built from an ordered list rather than an object literal so key order is
    // a property of this function, not of however the caller assembled it.
    const body = fields
      .map(([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`)
      .join(',')

    return `{${body}}`
  }

  private static timestamp(value: Date): string {
    return new Date(value).toISOString()
  }
}
