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
import AccessException from '@/exception/access-exception'

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

  /**
   * A viewer watches progress, not money: neither the owner's invoice nor a
   * worker's reaches them, by search or by id. See "Who can see what" in
   * SPEC.md. The owner is premium because that is where viewers used to be
   * let in; with the plan out of every access check it no longer matters.
   */
  @test()
  async invoice_isHiddenFromAProjectViewer() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    project.viewerAddresses = [viewer.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const ownersInvoice = await this.invoiceFixture.create(
      project,
      900,
      EInvoiceState.REQUESTED,
    )
    ownersInvoice.user = owner
    await runPromise(this.invoiceRepository.saveSingle(ownersInvoice))

    const workersInvoice = await this.invoiceFixture.create(
      project,
      1500,
      EInvoiceState.REQUESTED,
    )
    workersInvoice.user = worker
    await runPromise(this.invoiceRepository.saveSingle(workersInvoice))

    const [rows, count] = await runPromise(
      this.invoiceRepository.findAndCount(
        { ...search, filter: { projectId: project.id } },
        viewer,
      ),
    )

    expect(rows).to.have.length(0)
    expect(count).to.equal(0)

    for (const invoice of [ownersInvoice, workersInvoice]) {
      let error: unknown

      try {
        await runPromise(
          this.invoiceRepository.findOneConfirmUser(invoice, viewer),
        )
      } catch (e: unknown) {
        error = e
      }

      expect(error).to.be.instanceOf(AccessException)
    }
  }

  /**
   * Access follows who issued the invoice, not the issuer's current role. A
   * worker later moved to the viewer list still sees what they billed - it is
   * their own record of money owed to them.
   */
  @test()
  async issuerDemotedToViewer_stillSeesTheirOwnInvoice() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const invoice = await this.invoiceFixture.create(
      project,
      2100,
      EInvoiceState.REQUESTED,
    )
    invoice.user = worker
    await runPromise(this.invoiceRepository.saveSingle(invoice))

    project.workerAddresses = []
    project.viewerAddresses = [worker.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const [rows] = await runPromise(
      this.invoiceRepository.findAndCount(search, worker),
    )
    const read = await runPromise(
      this.invoiceRepository.findOneConfirmUser(invoice, worker),
    )
    const [ownerRows] = await runPromise(
      this.invoiceRepository.findAndCount(search, owner),
    )

    expect(rows.map((row) => row.id)).to.deep.equal([invoice.id])
    expect(read.id).to.equal(invoice.id)
    expect(ownerRows.map((row) => row.id)).to.include(invoice.id)
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
