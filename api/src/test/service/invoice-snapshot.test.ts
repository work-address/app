import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { InvoiceManager } from '@/service/invoice-manager'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { ProjectRepository } from '@/repository/project-repository'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { TimeFixture } from '@/test/fixture/time-fixture'
import { TimeRepository } from '@/repository/time-repository'
import { EInvoiceState } from '@/model/invoice'
import { runPromise } from '@/service/effect-bridge'

@suite()
export class InvoiceSnapshotTest extends AbstractDatabaseIntegration {
  private manager = this.container.get<InvoiceManager>('InvoiceManager')
  private invoices = this.container.get<InvoiceRepository>('InvoiceRepository')
  private projects = this.container.get<ProjectRepository>('ProjectRepository')
  private times = this.container.get<TimeRepository>('TimeRepository')
  private async scenario() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.container
      .get<ProjectFixture>('ProjectFixture')
      .createPersonal(owner, 60)
    project.workerAddresses = [worker.address]
    await runPromise(this.projects.saveSingle(project))
    const end = new Date(Date.now() - 3600000)
    const entry = await this.container
      .get<TimeFixture>('TimeFixture')
      .create(project, new Date(+end - 3600000), end, worker)
    entry.minutesActive = 10
    await runPromise(this.times.saveSingle(entry))
    return { owner, worker, project, entry }
  }
  @test()
  async freezesTrackedMinutesAndRateWhenProjectRateChanges() {
    const { worker, project } = await this.scenario()
    const invoice = (await runPromise(
      this.manager.ensureForProject(project, worker),
    ))!
    expect(invoice.lines?.[0]).to.include({
      minutes: 60,
      activeMinutes: 10,
      rateHourCents: 6000,
      basis: 'tracked',
      amountCents: 6000,
    })
    project.rateHour = 150
    await runPromise(this.projects.saveSingle(project))
    const read = await runPromise(this.manager.read(invoice, worker))
    expect(read.lines).to.deep.equal(invoice.lines)
    expect(read.report).to.include({ rateHour: 60, rateTotal: 60 })
  }
  @test()
  async legacyInvoiceKeepsItsChargedRateAndShowsUnknownForZeroActivity() {
    const { worker, project, entry } = await this.scenario()
    const invoice = (await runPromise(
      this.manager.ensureForProject(project, worker),
    ))!
    await this.invoices
      .getRepo()
      .update(invoice.id, { lines: null, amountCents: 1000 })
    project.rateHour = 150
    await runPromise(this.projects.saveSingle(project))
    let read = await runPromise(this.manager.read(invoice, worker))
    expect(read.lines?.[0]).to.include({
      basis: 'active',
      rateHourCents: 6000,
      minutes: 10,
      amountCents: 1000,
    })
    expect(read.report).to.include({ rateHour: 60, rateTotal: 10 })
    await this.times.getRepo().update(entry.id, { minutesActive: 0 })
    read = await runPromise(this.manager.read(invoice, worker))
    expect(read.lines?.[0].rateHourCents).to.equal(null)
    expect(read.report?.rateHour).to.equal(null)
    expect(read.amountCents).to.equal(1000)
  }

  @test()
  async rejectionSnapshotsLegacyTimeBeforeReleasingIt() {
    const { owner, worker, project, entry } = await this.scenario()
    const invoice = (await runPromise(
      this.manager.ensureForProject(project, worker),
    ))!
    await this.invoices
      .getRepo()
      .update(invoice.id, { lines: null, amountCents: 1000 })
    const before = await runPromise(this.manager.read(invoice, worker))
    await runPromise(this.manager.reject(invoice, owner))
    await this.times.getRepo().update(entry.id, { minutesActive: 1 })
    await runPromise(this.manager.ensureForProject(project, worker))
    const after = await runPromise(this.manager.read(invoice, worker))
    expect(after.lines).to.deep.equal(before.lines)
    expect(after.report).to.include({
      minutes: 10,
      rateHour: 60,
      rateTotal: 10,
    })
    expect(after.state).to.equal(EInvoiceState.REJECTED)
    expect(after.time).to.have.length(0)
    expect(
      (await this.invoices.getRepo().findOneByOrFail({ id: invoice.id })).lines,
    ).to.deep.equal(before.lines)
  }

  @test()
  async rejectionKeepsZeroActivityLegacyRateUnavailable() {
    const { owner, worker, project, entry } = await this.scenario()
    const invoice = (await runPromise(
      this.manager.ensureForProject(project, worker),
    ))!
    await this.invoices
      .getRepo()
      .update(invoice.id, { lines: null, amountCents: 1000 })
    await this.times.getRepo().update(entry.id, { minutesActive: 0 })
    await runPromise(this.manager.reject(invoice, owner))
    const read = await runPromise(this.manager.read(invoice, worker))
    expect(read.lines?.[0]).to.include({
      basis: 'active',
      minutes: 0,
      rateHourCents: null,
      amountCents: 1000,
    })
  }

  @test()
  async onlyOwnerCanRejectAndReleasedEntriesCanBeReissued() {
    const { owner, worker, project, entry } = await this.scenario()
    const invoice = (await runPromise(
      this.manager.ensureForProject(project, worker),
    ))!
    let refused = false
    try {
      await runPromise(this.manager.reject(invoice, worker))
    } catch {
      refused = true
    }
    expect(refused).to.equal(true)
    const rejected = await runPromise(
      this.manager.reject(invoice, owner, 'Please correct the period'),
    )
    expect(rejected.state).to.equal(EInvoiceState.REJECTED)
    expect(rejected.rejectionReason).to.equal('Please correct the period')
    expect(rejected.lines).to.deep.equal(invoice.lines)
    expect(
      await this.times
        .getRepo()
        .findOne({ where: { id: entry.id }, relations: { invoice: true } }),
    ).to.have.property('invoice', null)
    const replacement = (await runPromise(
      this.manager.ensureForProject(project, worker),
    ))!
    expect(replacement.id).not.to.equal(invoice.id)
    expect(replacement.amountCents).to.equal(invoice.amountCents)
    refused = false
    try {
      await runPromise(this.manager.markPaid(invoice, worker))
    } catch {
      refused = true
    }
    expect(refused).to.equal(true)
  }
  @test()
  async paymentAndRejectionCannotBothWin() {
    const { owner, worker, project, entry } = await this.scenario()
    const invoice = (await runPromise(
      this.manager.ensureForProject(project, worker),
    ))!
    const results = await Promise.allSettled([
      runPromise(this.manager.markPaid(invoice, worker)),
      runPromise(this.manager.reject(invoice, owner)),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).to.have.length(1)
    const saved = await runPromise(this.invoices.findOneByIdOrFail(invoice.id))
    const time = await this.times
      .getRepo()
      .findOneOrFail({ where: { id: entry.id }, relations: { invoice: true } })
    expect(Boolean(time.isPaid)).to.equal(saved.state === EInvoiceState.PAID)
    expect(Boolean(time.invoice)).to.equal(saved.state === EInvoiceState.PAID)
  }
  @test()
  async concurrentEnsureCreatesOnlyOneInvoice() {
    const { worker, project } = await this.scenario()
    const invoices = await Promise.all([
      runPromise(this.manager.ensureForProject(project, worker)),
      runPromise(this.manager.ensureForProject(project, worker)),
    ])
    expect(invoices[0]?.id).to.equal(invoices[1]?.id)
  }
}
