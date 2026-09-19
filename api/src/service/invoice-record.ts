import { injectable } from 'inversify'

import { Invoice } from '@/entity/invoice'
import {
  EInvoiceSnapshotVersion,
  IInvoiceLine,
  IInvoiceRecord,
} from '@/model/invoice'
import { CanonicalJson } from '@/service/canonical-json'
import IncompleteInvoiceSnapshotException from '@/exception/incomplete-invoice-snapshot-exception'
import LegacyInvoiceException from '@/exception/legacy-invoice-exception'

/**
 * InvoiceRecord v1: the canonical serialisation of an issued invoice.
 *
 * This is what an escrow invoice commitment hashes (see InvoiceCommitment),
 * so the same invoice must produce the same bytes forever, on any machine and
 * in any implementation. Hence:
 *  - RFC 8785 (JCS) text: keys sorted, no whitespace, so key order is a
 *    property of the format rather than of whoever built the object
 *  - integers only - money in cents, time in minutes - never floats, whose
 *    text form varies by platform
 *  - timestamps as ISO-8601 in UTC with milliseconds
 *  - addresses in canonical form, so two spellings of one wallet agree
 *  - an explicit version, so the shape can change without invalidating what
 *    was written under the old one
 *
 * It reads only the snapshot the invoice froze at issuance, never the live
 * project or user: an owner editing the rate afterwards must not change the
 * record of what was billed. It holds nothing that changes after issuance
 * either - not the paid state, which is settled after an escrow submission
 * has already committed to the record. An invoice without a v1 snapshot has
 * no record, and asking for one is refused rather than filled in - as is a
 * snapshot missing a field the record carries, its issuer included. Both
 * refusals are 409s: they describe the invoice, not a fault in the server,
 * so whichever endpoint asked answers with that instead of a 500.
 *
 * `api/src/test/fixture/invoice-record.v1.json` holds the vectors; a change
 * that moves one byte of their output needs a new version, not an edit.
 */
@injectable()
export class InvoiceRecord {
  public static readonly VERSION = EInvoiceSnapshotVersion.V1

  public serialise(invoice: Invoice): string {
    return CanonicalJson.stringify(this.document(invoice))
  }

  public document(invoice: Invoice): IInvoiceRecord {
    if (invoice.snapshotVersion !== InvoiceRecord.VERSION) {
      throw new LegacyInvoiceException(
        `Invoice ${invoice.id} has no v${InvoiceRecord.VERSION} snapshot, so it has no InvoiceRecord`,
      )
    }

    const required = <T>(value: T | null | undefined, field: string): T =>
      InvoiceRecord.required(invoice, value, field)

    return {
      version: InvoiceRecord.VERSION,
      invoiceId: invoice.id,
      projectId: invoice.project.id,
      // The relation, not a snapshot column: Invoice.user is nullable for
      // rows older than issuers, so a snapshotted row can still lack one.
      issuerId: required(invoice.user?.id, 'issuer'),
      issuerAddress: required(invoice.issuerAddress, 'issuerAddress'),
      ownerAddress: required(invoice.ownerAddress, 'ownerAddress'),
      currency: required(invoice.currency, 'currency'),
      rateHourCents: required(invoice.rateHourCents, 'rateHourCents'),
      minutesActive: required(invoice.minutesActive, 'minutesActive'),
      amountCents: invoice.amountCents,
      periodStart: InvoiceRecord.timestamp(invoice.fromAt),
      periodEnd: InvoiceRecord.timestamp(invoice.toAt),
      lines: InvoiceRecord.ordered(required(invoice.lines, 'lines')).map(
        (line) => ({
          timeId: line.timeId,
          fromAt: InvoiceRecord.timestamp(line.fromAt),
          toAt: InvoiceRecord.timestamp(line.toAt),
          minutesActive: line.minutesActive,
        }),
      ),
    }
  }

  /**
   * Lines in the order the snapshot is written in: by start, then by id.
   * Sorted again here so the record does not depend on how the array was
   * stored or loaded.
   */
  public static ordered(lines: IInvoiceLine[]): IInvoiceLine[] {
    return [...lines].sort((a, b) => {
      const byStart =
        new Date(a.fromAt).getTime() - new Date(b.fromAt).getTime()

      if (byStart !== 0) {
        return byStart
      }

      if (a.timeId === b.timeId) {
        return 0
      }

      return a.timeId < b.timeId ? -1 : 1
    })
  }

  public static timestamp(value: Date | string): string {
    return new Date(value).toISOString()
  }

  private static required<T>(
    invoice: Invoice,
    value: T | null | undefined,
    field: string,
  ): T {
    if (value === null || value === undefined) {
      throw new IncompleteInvoiceSnapshotException(
        `Invoice ${invoice.id}'s snapshot has no ${field}, so it has no InvoiceRecord`,
      )
    }

    return value
  }
}
