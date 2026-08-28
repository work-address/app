import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { EInvoiceState } from '@/model/invoice'
import { EProjectState } from '@/model/project'
import { InvoiceFixture } from '@/test/fixture/invoice-fixture'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { ProjectRepository } from '@/repository/project-repository'
import { UserFixture } from '@/test/fixture/user-fixture'
import { runPromise } from '@/service/effect-bridge'

const search = { filter: {}, sort: { createdAt: 'ASC' as const }, page: 0 }

/**
 * Who the invoice list returns rows to.
 *
 * Legacy rows carry no issuer - they predate `Invoice.user` - so they must
 * still reach the project owner, or every invoice created before that field
 * existed silently disappears from the list.
 */
@suite()
export class InvoiceAccessTest extends AbstractDatabaseIntegration {
  protected userFixture: UserFixture
  protected projectFixture: ProjectFixture
  protected invoiceFixture: InvoiceFixture
  protected invoiceRepository: InvoiceRepository
  protected projectRepository: ProjectRepository

  constructor() {
    super()

    this.userFixture = this.container.get('UserFixture')
    this.projectFixture = this.container.get('ProjectFixture')
    this.invoiceFixture = this.container.get('InvoiceFixture')
    this.invoiceRepository = this.container.get('InvoiceRepository')
    this.projectRepository = this.container.get('ProjectRepository')
  }

  /** The case a pre-existing invoice falls into: no issuer recorded. */
  @test()
  async legacyInvoiceWithNoIssuer_isVisibleToTheProjectOwner() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const invoice = await this.invoiceFixture.create(
      project,
      3300,
      EInvoiceState.REQUESTED,
    )

    const [rows] = await runPromise(
      this.invoiceRepository.findAndCount(search, owner),
    )

    expect(rows.map((row) => row.id)).to.include(invoice.id)
  }

  @test()
  async ownIssuedInvoice_isVisibleToTheIssuer() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const invoice = await this.invoiceFixture.create(
      project,
      1200,
      EInvoiceState.REQUESTED,
    )
    invoice.user = worker
    await runPromise(this.invoiceRepository.saveSingle(invoice))

    const [rows] = await runPromise(
      this.invoiceRepository.findAndCount(search, worker),
    )

    expect(rows.map((row) => row.id)).to.include(invoice.id)
  }

  @test()
  async workersInvoice_isVisibleToTheProjectOwner() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const invoice = await this.invoiceFixture.create(
      project,
      1200,
      EInvoiceState.REQUESTED,
    )
    invoice.user = worker
    await runPromise(this.invoiceRepository.saveSingle(invoice))

    const [rows] = await runPromise(
      this.invoiceRepository.findAndCount(search, owner),
    )

    expect(rows.map((row) => row.id)).to.include(invoice.id)
  }

  @test()
  async invoice_isVisibleToAProjectViewer() {
    const owner = await this.userFixture.createPremiumUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.viewerAddresses = [viewer.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const invoice = await this.invoiceFixture.create(
      project,
      900,
      EInvoiceState.REQUESTED,
    )

    const [rows] = await runPromise(
      this.invoiceRepository.findAndCount(search, viewer),
    )

    expect(rows.map((row) => row.id)).to.include(invoice.id)
  }

  /** One contractor's rate is not another contractor's business. */
  @test()
  async anotherWorkersInvoice_isHiddenFromAWorker() {
    const owner = await this.userFixture.createPremiumUser()
    const workerA = await this.userFixture.createUser()
    const workerB = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [workerA.address, workerB.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const invoice = await this.invoiceFixture.create(
      project,
      4200,
      EInvoiceState.REQUESTED,
    )
    invoice.user = workerA
    await runPromise(this.invoiceRepository.saveSingle(invoice))

    const [rows] = await runPromise(
      this.invoiceRepository.findAndCount(search, workerB),
    )

    expect(rows.map((row) => row.id)).to.not.include(invoice.id)
  }
}
