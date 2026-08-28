import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import moment from 'moment'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { EProjectState } from '@/model/project'
import { InvoiceManager } from '@/service/invoice-manager'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeFixture } from '@/test/fixture/time-fixture'
import { TimeRepository } from '@/repository/time-repository'
import { UserFixture } from '@/test/fixture/user-fixture'

import type { Project } from '@/entity/project'
import type { Time } from '@/entity/time'
import type { User } from '@/entity/user'
import { runPromise } from '@/service/effect-bridge'

/**
 * Invoicing a hand-picked set of entries from the time table.
 *
 * The entries are linked to the invoice, not merely spanned by its dates —
 * these assert that a sparse selection leaves the days in between alone.
 */
@suite()
export class InvoiceSelectionTest extends AbstractDatabaseIntegration {
  protected userFixture: UserFixture
  protected projectFixture: ProjectFixture
  protected timeFixture: TimeFixture
  protected invoiceManager: InvoiceManager
  protected timeRepository: TimeRepository
  protected projectRepository: ProjectRepository

  constructor() {
    super()

    this.userFixture = this.container.get('UserFixture')
    this.projectFixture = this.container.get('ProjectFixture')
    this.timeFixture = this.container.get('TimeFixture')
    this.invoiceManager = this.container.get('InvoiceManager')
    this.timeRepository = this.container.get('TimeRepository')
    this.projectRepository = this.container.get('ProjectRepository')
  }

  private async entry(
    project: Project,
    user: User,
    daysAgo: number,
    minutes = 60,
  ): Promise<Time> {
    const from = moment.utc().subtract(daysAgo, 'days')
    const time = await this.timeFixture.create(
      project,
      from.toDate(),
      from.clone().add(minutes, 'minutes').toDate(),
      user,
    )

    time.minutesActive = minutes
    await runPromise(this.timeRepository.saveSingle(time))

    return time
  }

  private async scenario() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.rateHour = 60
    await runPromise(this.projectRepository.saveSingle(project))

    const monday = await this.entry(project, owner, 5)
    const wednesday = await this.entry(project, owner, 3)
    const friday = await this.entry(project, owner, 1)

    return { owner, project, monday, wednesday, friday }
  }

  @test()
  async createFromTimeIds_billsOnlyTheSelectedEntries() {
    const { owner, project, monday, friday } = await this.scenario()

    const invoice = await runPromise(
      this.invoiceManager.createFromTimeIds(project, owner, [
        monday.id,
        friday.id,
      ]),
    )

    // Two hours at $60, not three - Wednesday was not selected.
    expect(invoice.amountCents).to.be.equal(12_000)
  }

  /**
   * The heart of it. The invoice's period spans Monday to Friday, so a
   * date-overlap model would treat Wednesday as billed. The link does not.
   */
  @test()
  async createFromTimeIds_leavesUnselectedEntriesInBetweenInvoiceable() {
    const { owner, project, monday, wednesday, friday } = await this.scenario()

    await runPromise(
      this.invoiceManager.createFromTimeIds(project, owner, [
        monday.id,
        friday.id,
      ]),
    )

    const outstanding = await runPromise(
      this.timeRepository.findUninvoicedUnpaidTimeForAuthor(project, owner),
    )

    expect(outstanding.map((time) => time.id)).to.deep.equal([wednesday.id])
  }

  @test()
  async markPaid_marksOnlyTheLinkedEntries() {
    const { owner, project, monday, wednesday, friday } = await this.scenario()

    const invoice = await runPromise(
      this.invoiceManager.createFromTimeIds(project, owner, [
        monday.id,
        friday.id,
      ]),
    )
    await runPromise(this.invoiceManager.markPaid(invoice, owner))

    const reloadedWednesday = await runPromise(
      this.timeRepository.findOneByIdOrFail(wednesday.id),
    )
    const reloadedMonday = await runPromise(
      this.timeRepository.findOneByIdOrFail(monday.id),
    )

    expect(reloadedMonday.isPaid).to.be.true
    expect(reloadedWednesday.isPaid).to.not.be.true
  }

  /** Selecting an already-invoiced entry refuses the whole request. */
  @test()
  async createFromTimeIds_refusesAlreadyInvoicedEntries() {
    const { owner, project, monday, friday } = await this.scenario()

    await runPromise(
      this.invoiceManager.createFromTimeIds(project, owner, [monday.id]),
    )

    let error: Error | undefined

    try {
      await runPromise(
        this.invoiceManager.createFromTimeIds(project, owner, [
          monday.id,
          friday.id,
        ]),
      )
    } catch (e: unknown) {
      error = e as Error
    }

    expect(error?.message).to.contain('already on an invoice')
  }

  /** And so does selecting somebody else's. */
  @test()
  async createFromTimeIds_refusesAnotherContributorsEntries() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    project.rateHour = 60
    await runPromise(this.projectRepository.saveSingle(project))

    const ownerEntry = await this.entry(project, owner, 2)

    let error: Error | undefined

    try {
      await runPromise(
        this.invoiceManager.createFromTimeIds(project, worker, [ownerEntry.id]),
      )
    } catch (e: unknown) {
      error = e as Error
    }

    expect(error?.message).to.contain('not yours')
  }
}
