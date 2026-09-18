import { expect } from 'chai'
import moment from 'moment'
import { suite, test } from '@testdeck/mocha'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { InvoiceSnapshotBackfill } from '@/scripts/backfill-invoice-snapshot'
import { InvoiceFixture } from '@/test/fixture/invoice-fixture'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { TimeFixture } from '@/test/fixture/time-fixture'
import { InvoiceManager } from '@/service/invoice-manager'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { TimeRepository } from '@/repository/time-repository'
import { Invoice } from '@/entity/invoice'
import { EInvoiceSnapshotVersion, EInvoiceState } from '@/model/invoice'
import { runPromise } from '@/service/effect-bridge'

/**
 * The backfill labels invoices issued before snapshots as legacy and invents
 * nothing: no rate, no lines, no new amount. Run twice, the second run finds
 * nothing to do.
 */
@suite()
export class BackfillInvoiceSnapshotTest extends AbstractDatabaseIntegration {
  protected invoiceFixture: InvoiceFixture
  protected projectFixture: ProjectFixture
  protected timeFixture: TimeFixture
  protected invoiceManager: InvoiceManager
  protected invoiceRepository: InvoiceRepository
  protected timeRepository: TimeRepository

  constructor() {
    super()

    this.invoiceFixture = this.container.get('InvoiceFixture')
    this.projectFixture = this.container.get('ProjectFixture')
    this.timeFixture = this.container.get('TimeFixture')
    this.invoiceManager = this.container.get('InvoiceManager')
    this.invoiceRepository = this.container.get('InvoiceRepository')
    this.timeRepository = this.container.get('TimeRepository')
  }

  private backfill(): InvoiceSnapshotBackfill {
    return new InvoiceSnapshotBackfill(this.invoiceRepository)
  }

  private async reread(invoice: Invoice): Promise<Invoice> {
    const found = await runPromise(
      this.invoiceRepository.findOneBy({
        where: { id: invoice.id },
        withDeleted: true,
      }),
    )

    return found!
  }

  @test()
  async run_marksPreSnapshotInvoicesLegacyAndIsIdempotent() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    // Written the way invoices were before snapshots: amount only.
    const legacy = await this.invoiceFixture.create(
      project,
      4200,
      EInvoiceState.PAID,
    )
    const deleted = await this.invoiceFixture.create(
      project,
      100,
      EInvoiceState.REQUESTED,
    )

    await runPromise(this.invoiceRepository.softDelete({ id: deleted.id }))

    const now = moment.utc()
    const time = await this.timeFixture.create(
      project,
      now.clone().subtract(2, 'hours').toDate(),
      now.clone().subtract(1, 'hours').toDate(),
    )

    time.minutesActive = 30
    await runPromise(this.timeRepository.saveSingle(time))

    const issued = await runPromise(
      this.invoiceManager.ensureForProject(project, owner),
    )

    expect((await this.reread(legacy)).snapshotVersion).to.be.null

    const first = await this.backfill().run()

    expect(first).to.be.at.least(2)

    for (const invoice of [legacy, deleted]) {
      const marked = await this.reread(invoice)

      expect(marked.snapshotVersion).to.be.eq(EInvoiceSnapshotVersion.LEGACY)
      expect(marked.amountCents).to.be.eq(invoice.amountCents)
      expect(marked.rateHourCents).to.be.null
      expect(marked.minutesActive).to.be.null
      expect(marked.lines).to.be.null
      expect(marked.currency).to.be.null
    }

    const snapshotted = await this.reread(issued!)

    expect(snapshotted.snapshotVersion).to.be.eq(EInvoiceSnapshotVersion.V1)
    expect(snapshotted.rateHourCents).to.be.eq(6000)
    expect(snapshotted.amountCents).to.be.eq(3000)

    const second = await this.backfill().run()

    expect(second).to.be.eq(0)
    expect((await this.reread(legacy)).snapshotVersion).to.be.eq(
      EInvoiceSnapshotVersion.LEGACY,
    )
    expect(await this.reread(issued!)).to.deep.include({
      snapshotVersion: EInvoiceSnapshotVersion.V1,
      rateHourCents: 6000,
      amountCents: 3000,
    })
  }

  /** A marked legacy invoice still reads, with no rate rather than today's. */
  @test()
  async legacyInvoice_readsWithoutARate() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    const legacy = await this.invoiceFixture.create(
      project,
      4200,
      EInvoiceState.REQUESTED,
    )

    await this.backfill().run()

    const read = await runPromise(this.invoiceManager.read(legacy, owner))

    expect(read.snapshotVersion).to.be.eq(EInvoiceSnapshotVersion.LEGACY)
    expect(read.report?.rateHour).to.be.null
    expect(read.report?.rateTotal).to.be.null
    expect(read.amountCents).to.be.eq(4200)
  }
}
