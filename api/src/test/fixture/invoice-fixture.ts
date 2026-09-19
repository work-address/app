import { inject, injectable } from 'inversify'
import { Project } from '@/entity/project'
import { User } from '@/entity/user'

import { InvoiceRepository } from '@/repository/invoice-repository'
import { Invoice } from '@/entity/invoice'
import {
  EInvoiceCurrency,
  EInvoiceSnapshotVersion,
  EInvoiceState,
  IInvoiceRecord,
} from '@/model/invoice'
import { InvoiceRecord } from '@/service/invoice-record'
import { WalletAddress } from '@/service/wallet-address'
import { runPromise } from '@/service/effect-bridge'

@injectable()
export class InvoiceFixture {
  @inject('InvoiceRepository')
  protected invoiceRepository: InvoiceRepository

  /** `amountCents` - whole cents, matching the entity. */
  public create(
    project: Project,
    amountCents: number,
    state: EInvoiceState,
  ): Promise<Invoice> {
    const invoice = new Invoice()

    invoice.project = project
    invoice.amountCents = amountCents
    invoice.state = state
    invoice.fromAt = new Date(Date.now() - 86400000)
    invoice.toAt = new Date()

    return runPromise(this.invoiceRepository.saveSingle(invoice))
  }

  /**
   * An unpaid invoice `issuer` raised on `project` for `amountCents`, with
   * the v1 snapshot issuance writes: one hour-long line of 60 active minutes
   * at `amountCents` an hour, so the snapshot explains its own amount. It
   * links no time rows - the record reads the snapshot, not the entries.
   */
  public createIssued(
    project: Project,
    issuer: User,
    amountCents: number,
  ): Promise<Invoice> {
    // One instant; both ends derive from it.
    const end = new Date(Math.floor(Date.now() / 60000) * 60000)
    const start = new Date(end.getTime() - 3600000)

    return this.createFromRecord(
      {
        version: InvoiceRecord.VERSION,
        invoiceId: '',
        projectId: project.id,
        issuerId: issuer.id,
        issuerAddress: WalletAddress.toCanonical(issuer.address),
        ownerAddress: WalletAddress.toCanonical(project.user.address),
        currency: EInvoiceCurrency.USD,
        rateHourCents: amountCents,
        minutesActive: 60,
        amountCents,
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        lines: [
          {
            timeId: '00000000-0000-4000-8000-000000000000',
            fromAt: start.toISOString(),
            toAt: end.toISOString(),
            minutesActive: 60,
          },
        ],
      },
      project,
      issuer,
    )
  }

  /**
   * The invoice whose InvoiceRecord v1 is `record`: its snapshot columns,
   * and its own id when the record names one, so a test can reproduce a
   * published vector byte for byte.
   */
  public createFromRecord(
    record: IInvoiceRecord,
    project: Project,
    issuer: User,
  ): Promise<Invoice> {
    const invoice = new Invoice()

    if (record.invoiceId) {
      invoice.id = record.invoiceId
    }

    invoice.project = project
    invoice.user = issuer
    invoice.fromAt = new Date(record.periodStart)
    invoice.toAt = new Date(record.periodEnd)
    invoice.snapshotVersion = EInvoiceSnapshotVersion.V1
    invoice.issuerAddress = record.issuerAddress
    invoice.ownerAddress = record.ownerAddress
    invoice.currency = record.currency as EInvoiceCurrency
    invoice.rateHourCents = record.rateHourCents
    invoice.minutesActive = record.minutesActive
    invoice.amountCents = record.amountCents
    invoice.lines = record.lines.map((line) => ({ ...line }))
    invoice.state = EInvoiceState.REQUESTED
    invoice.paidAt = null

    return runPromise(this.invoiceRepository.saveSingle(invoice))
  }
}
