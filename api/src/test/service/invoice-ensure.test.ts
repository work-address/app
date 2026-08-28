import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import moment from 'moment'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { EProjectState } from '@/model/project'
import { InvoiceManager } from '@/service/invoice-manager'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeFixture } from '@/test/fixture/time-fixture'
import { TimeRepository } from '@/repository/time-repository'
import { UserFixture } from '@/test/fixture/user-fixture'
import { runPromise } from '@/service/effect-bridge'

/**
 * "Open the invoice for this project" - raise one for whatever is outstanding,
 * or hand back the last one if nothing is.
 */
@suite()
export class InvoiceEnsureTest extends AbstractDatabaseIntegration {
  protected userFixture: UserFixture
  protected projectFixture: ProjectFixture
  protected timeFixture: TimeFixture
  protected invoiceManager: InvoiceManager
  protected invoiceRepository: InvoiceRepository
  protected timeRepository: TimeRepository
  protected projectRepository: ProjectRepository

  constructor() {
    super()

    this.userFixture = this.container.get('UserFixture')
    this.projectFixture = this.container.get('ProjectFixture')
    this.timeFixture = this.container.get('TimeFixture')
    this.invoiceManager = this.container.get('InvoiceManager')
    this.invoiceRepository = this.container.get('InvoiceRepository')
    this.timeRepository = this.container.get('TimeRepository')
    this.projectRepository = this.container.get('ProjectRepository')
  }

  private async projectWithOwner(rateHour = 60) {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.rateHour = rateHour
    await runPromise(this.projectRepository.saveSingle(project))

    return { owner, project }
  }

  private async track(
    project: never,
    user: never,
    hoursAgo: number,
    minutes: number,
  ) {
    const from = moment.utc().subtract(hoursAgo, 'hours')
    const entry = await this.timeFixture.create(
      project,
      from.toDate(),
      from.clone().add(minutes, 'minutes').toDate(),
      user,
    )
    entry.minutesActive = minutes
    await runPromise(this.timeRepository.saveSingle(entry))

    return entry
  }

  @test()
  async ensure_raisesAnInvoiceForOutstandingTime() {
    const { owner, project } = await this.projectWithOwner()
    await this.track(project as never, owner as never, 3, 60)

    const invoice = await runPromise(
      this.invoiceManager.ensureForProject(project, owner),
    )

    expect(invoice?.amountCents).to.be.equal(6000)
    expect(invoice?.user?.id).to.be.equal(owner.id)
  }

  /**
   * The important one. Creating an invoice does not mark its hours paid, so
   * without an overlap check a second click would raise a second invoice for
   * the same work and bill it twice.
   */
  @test()
  async ensure_isIdempotent_secondCallRaisesNothingNew() {
    const { owner, project } = await this.projectWithOwner()
    await this.track(project as never, owner as never, 3, 60)

    const first = await runPromise(
      this.invoiceManager.ensureForProject(project, owner),
    )
    const second = await runPromise(
      this.invoiceManager.ensureForProject(project, owner),
    )

    expect(second?.id).to.be.equal(first?.id)

    const [rows, count] = await runPromise(
      this.invoiceRepository.findAndCount(
        { filter: {}, sort: { createdAt: 'ASC' }, page: 0 },
        owner,
      ),
    )
    expect(count).to.be.equal(1)
    expect(rows).to.have.length(1)
  }

  /** New work after an invoice gets its own invoice; the old one is untouched. */
  @test()
  async ensure_raisesASecondInvoiceForNewerTime_keepingTheFirst() {
    const { owner, project } = await this.projectWithOwner()
    await this.track(project as never, owner as never, 10, 60)

    const first = await runPromise(
      this.invoiceManager.ensureForProject(project, owner),
    )

    await this.track(project as never, owner as never, 2, 30)

    const second = await runPromise(
      this.invoiceManager.ensureForProject(project, owner),
    )

    expect(second?.id).to.not.be.equal(first?.id)
    expect(second?.amountCents).to.be.equal(3000)

    const reloadedFirst = await runPromise(
      this.invoiceRepository.findOneByIdOrFail(first?.id as string),
    )
    expect(reloadedFirst.amountCents).to.be.equal(6000)
  }

  @test()
  async ensure_withNothingTracked_returnsNull() {
    const { owner, project } = await this.projectWithOwner()

    const invoice = await runPromise(
      this.invoiceManager.ensureForProject(project, owner),
    )

    expect(invoice).to.be.null
  }

  /** Each contributor's click raises their own invoice, for their own hours. */
  @test()
  async ensure_scopesToTheCallersOwnTime() {
    const { owner, project } = await this.projectWithOwner()
    const worker = await this.userFixture.createUser()
    project.workerAddresses = [worker.address]
    await runPromise(this.projectRepository.saveSingle(project))

    await this.track(project as never, owner as never, 5, 60)
    await this.track(project as never, worker as never, 4, 30)

    const ownerInvoice = await runPromise(
      this.invoiceManager.ensureForProject(project, owner),
    )
    const workerInvoice = await runPromise(
      this.invoiceManager.ensureForProject(project, worker),
    )

    expect(ownerInvoice?.amountCents).to.be.equal(6000)
    expect(workerInvoice?.amountCents).to.be.equal(3000)
  }

  /** Settled hours are not outstanding, so they are never re-invoiced. */
  @test()
  async ensure_afterPayment_doesNotReinvoiceSettledHours() {
    const { owner, project } = await this.projectWithOwner()
    await this.track(project as never, owner as never, 3, 60)

    const first = await runPromise(
      this.invoiceManager.ensureForProject(project, owner),
    )
    await runPromise(this.invoiceManager.markPaid(first as never, owner))

    const second = await runPromise(
      this.invoiceManager.ensureForProject(project, owner),
    )

    expect(second?.id).to.be.equal(first?.id)
  }
}
