import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import moment from 'moment'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { ConcurrentCalls } from '@/test/fixture/concurrent-calls'
import { ForcedWriteFailure } from '@/test/fixture/forced-write-failure'
import { Invoice } from '@/entity/invoice'
import { Time } from '@/entity/time'
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

  /**
   * A double click on "Invoice" sends two of these at once. Both used to read
   * the same outstanding rows before either linked them, and each raised its
   * own invoice for the same hours. Four at once, to leave no doubt.
   */
  @test()
  async ensure_parallelCalls_raiseOneInvoice() {
    const { owner, project } = await this.projectWithOwner()
    const earlier = await this.track(project as never, owner as never, 5, 60)
    const later = await this.track(project as never, owner as never, 3, 30)

    const settled = await new ConcurrentCalls(this.conn).settle(
      [1, 2, 3, 4].map(
        () => () =>
          runPromise(this.invoiceManager.ensureForProject(project, owner)),
      ),
    )
    const results = settled.map((result) => {
      if (result.status === 'rejected') throw result.reason
      return result.value
    })

    const ids = new Set(results.map((invoice) => invoice?.id))
    expect(ids.size).to.be.equal(1)
    expect(await this.conn.getRepository(Invoice).count()).to.be.equal(1)

    const [invoice] = results
    const lines = await runPromise(
      this.timeRepository.findForInvoice(invoice as Invoice),
    )
    expect(lines.map((time) => time.id).sort()).to.deep.equal(
      [earlier.id, later.id].sort(),
    )
    expect(invoice?.amountCents).to.be.equal(9000)
  }

  /**
   * Saving the invoice and linking its time are one write or none. A failure
   * linking the time used to leave the invoice behind - an amount owed with
   * no line behind it, and hours that the next click would bill again.
   */
  @test()
  async ensure_aFailureLinkingTheTime_leavesNoInvoice() {
    const { owner, project } = await this.projectWithOwner()
    await this.track(project as never, owner as never, 3, 60)

    let error: Error | undefined

    await new ForcedWriteFailure(this.conn).duringUpdatesOf(Time, async () => {
      try {
        await runPromise(this.invoiceManager.ensureForProject(project, owner))
      } catch (e: unknown) {
        error = e as Error
      }
    })

    expect(error?.message).to.contain(ForcedWriteFailure.MESSAGE)
    expect(await this.conn.getRepository(Invoice).count()).to.be.equal(0)

    const outstanding = await runPromise(
      this.timeRepository.findUninvoicedUnpaidTimeForAuthor(project, owner),
    )
    expect(outstanding).to.have.length(1)
  }
}
