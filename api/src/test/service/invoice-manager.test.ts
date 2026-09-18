import { expect } from 'chai'
import moment from 'moment'
import { HttpError } from 'routing-controllers'
import { suite, test } from '@testdeck/mocha'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { InvoiceManager } from '@/service/invoice-manager'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeFixture } from '@/test/fixture/time-fixture'
import { TimeRepository } from '@/repository/time-repository'
import { Entitlement } from '@/service/entitlement'
import { Invoice } from '@/entity/invoice'
import { Project } from '@/entity/project'
import { Time } from '@/entity/time'
import { User } from '@/entity/user'
import { runPromise } from '@/service/effect-bridge'

@suite()
export class InvoiceManagerTest extends AbstractDatabaseIntegration {
  protected invoiceManager: InvoiceManager
  protected projectFixture: ProjectFixture
  protected projectRepository: ProjectRepository
  protected timeFixture: TimeFixture
  protected timeRepository: TimeRepository
  protected entitlement: Entitlement

  constructor() {
    super()
    this.invoiceManager = this.container.get('InvoiceManager')
    this.projectFixture = this.container.get('ProjectFixture')
    this.projectRepository = this.container.get('ProjectRepository')
    this.timeFixture = this.container.get('TimeFixture')
    this.timeRepository = this.container.get('TimeRepository')
    this.entitlement = this.container.get('Entitlement')
  }

  /**
   * Runs `body` as a self-hosted instance: no entitlement secret, so no
   * billing service and nothing ever sets `premium`. The config object is the
   * one the container hands every service, so the mode applies throughout,
   * and it is restored even when an assertion fails.
   */
  private async asSelfHosted(body: () => Promise<void>): Promise<void> {
    const secret = this.parameters.entitlementSecret

    this.parameters.entitlementSecret = ''

    try {
      await body()
    } finally {
      this.parameters.entitlementSecret = secret
    }
  }

  /** One hour of the author's time, ending `hoursAgo - 1` hours ago. */
  private async hourOfWork(
    project: Project,
    author: User,
    hoursAgo: number,
  ): Promise<Time> {
    const fromAt = moment.utc().subtract(hoursAgo, 'hours')
    const time = await this.timeFixture.create(
      project,
      fromAt.toDate(),
      fromAt.clone().add(1, 'hour').toDate(),
      author,
    )

    time.minutesActive = 60

    return runPromise(this.timeRepository.saveSingle(time))
  }

  /** The ids of the entries an invoice bills, by its link. */
  private async linesOf(invoice: Invoice): Promise<string[]> {
    const lines = await runPromise(this.timeRepository.findForInvoice(invoice))

    return lines.map((time) => time.id).sort()
  }

  private async failureOf(run: () => Promise<unknown>): Promise<HttpError> {
    try {
      await run()
    } catch (error: unknown) {
      return error as HttpError
    }

    throw new Error('Expected the call to fail')
  }

  @test()
  /**
   * Each person invoices their own hours. Previously one invoice summed every
   * contributor's time on the project, which meant an owner billed for a
   * worker's hours in a record that named nobody - and the worker had no way
   * to raise their own.
   */
  async create_scopesToTheIssuersOwnTimeOnly() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    project.workerAddresses = [worker.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const fromAt = moment.utc().subtract(3, 'hours')
    const toAt = moment.utc().subtract(1, 'hour')

    const ownerTime = await this.timeFixture.create(
      project,
      fromAt.toDate(),
      fromAt.clone().add(1, 'hour').toDate(),
      owner,
    )
    ownerTime.minutesActive = 60
    await runPromise(this.timeRepository.saveSingle(ownerTime))

    const workerTime = await this.timeFixture.create(
      project,
      fromAt.clone().add(1, 'hour').toDate(),
      toAt.toDate(),
      worker,
    )
    workerTime.minutesActive = 30
    await runPromise(this.timeRepository.saveSingle(workerTime))

    const ownerInvoice = await runPromise(
      this.invoiceManager.create(
        { fromUnix: fromAt.valueOf(), toUnix: toAt.valueOf() },
        project,
        owner,
      ),
    )

    // 60 minutes at $60/hour = 6000 cents. The worker's 30 minutes are not
    // the owner's to bill for.
    expect(ownerInvoice.amountCents).to.equal(6000)
    expect(ownerInvoice.user?.id).to.equal(owner.id)

    const workerInvoice = await runPromise(
      this.invoiceManager.create(
        { fromUnix: fromAt.valueOf(), toUnix: toAt.valueOf() },
        project,
        worker,
      ),
    )

    expect(workerInvoice.amountCents).to.equal(3000)
    expect(workerInvoice.user?.id).to.equal(worker.id)
  }

  @test()
  async create_excludesPaidTimeInRange() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)

    const fromAt = moment.utc().subtract(3, 'hours')
    const toAt = moment.utc().subtract(1, 'hour')

    const unpaidTime = await this.timeFixture.create(
      project,
      fromAt.toDate(),
      fromAt.clone().add(1, 'hour').toDate(),
      owner,
    )
    unpaidTime.minutesActive = 60
    await runPromise(this.timeRepository.saveSingle(unpaidTime))

    const paidTime = await this.timeFixture.create(
      project,
      fromAt.clone().add(1, 'hour').toDate(),
      toAt.toDate(),
      owner,
    )
    paidTime.minutesActive = 120
    paidTime.isPaid = true
    await runPromise(this.timeRepository.saveSingle(paidTime))

    const invoice = await runPromise(
      this.invoiceManager.create(
        {
          fromUnix: fromAt.valueOf(),
          toUnix: toAt.valueOf(),
        },
        project,
        owner,
      ),
    )

    expect(invoice.amountCents).to.equal(6000)
  }

  @test()
  /**
   * Collaborators are free, so the owner's plan does not decide who may
   * invoice - the role does. A worker on a free owner's project on the hosted
   * service bills their own hours like any other worker.
   */
  async create_letsAWorkerOnAFreeOwnersProjectInvoice() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    project.workerAddresses = [worker.address]
    await runPromise(this.projectRepository.saveSingle(project))

    await this.hourOfWork(project, worker, 3)

    const invoice = await runPromise(
      this.invoiceManager.create(
        {
          fromUnix: moment.utc().subtract(1, 'day').valueOf(),
          toUnix: moment.utc().valueOf(),
        },
        project,
        worker,
      ),
    )

    expect(this.entitlement.isSaaS()).to.be.true
    expect(this.entitlement.isPremium(owner)).to.be.false
    expect(invoice.user?.id).to.equal(worker.id)
    expect(invoice.amountCents).to.equal(6000)
  }

  @test()
  /**
   * G11. A self-hosted instance has no billing service, so `premium` is never
   * set on anyone. The role check used to fall back to that column, so a
   * worker could open the project and then be refused an invoice for their
   * own hours. Every creation mode is exercised - each one goes through the
   * same check.
   */
  async selfHosted_workerOnAFreeOwnersProjectInvoicesInEveryMode() {
    await this.asSelfHosted(async () => {
      const owner = await this.userFixture.createUser()
      const worker = await this.userFixture.createUser()
      const project = await this.projectFixture.createPersonal(owner, 60)
      project.workerAddresses = [worker.address]
      await runPromise(this.projectRepository.saveSingle(project))

      expect(this.entitlement.isSaaS()).to.be.false
      expect(owner.premium).to.not.be.ok

      // By range: a window around exactly one entry.
      const inRange = await this.hourOfWork(project, worker, 9)
      const byRange = await runPromise(
        this.invoiceManager.create(
          {
            fromUnix: new Date(inRange.fromAt).getTime(),
            toUnix: new Date(inRange.toAt).getTime(),
          },
          project,
          worker,
        ),
      )

      // By selection.
      const selected = await this.hourOfWork(project, worker, 6)
      const byIds = await runPromise(
        this.invoiceManager.createFromTimeIds(project, worker, [selected.id]),
      )

      // Everything still outstanding.
      await this.hourOfWork(project, worker, 3)
      const ensured = await runPromise(
        this.invoiceManager.ensureForProject(project, worker),
      )

      for (const invoice of [byRange, byIds, ensured]) {
        expect(invoice?.user?.id).to.equal(worker.id)
        expect(invoice?.amountCents).to.equal(6000)
      }
      expect(new Set([byRange.id, byIds.id, ensured?.id]).size).to.equal(3)
    })
  }

  @test()
  /**
   * G3. The range query used to check `isPaid` only, and raising an invoice
   * does not mark its hours paid, so a range over hours already on a
   * REQUESTED invoice re-pointed them at a second one: the first kept its
   * amount but lost its lines, and the same hours were billed twice.
   */
  async create_rangeOverTimeAlreadyOnAnInvoice_isRefusedAndMovesNothing() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    const earlier = await this.hourOfWork(project, owner, 5)
    const later = await this.hourOfWork(project, owner, 3)

    const first = await runPromise(
      this.invoiceManager.createFromTimeIds(project, owner, [
        earlier.id,
        later.id,
      ]),
    )

    const error = await this.failureOf(() =>
      runPromise(
        this.invoiceManager.create(
          {
            fromUnix: new Date(earlier.fromAt).getTime(),
            toUnix: new Date(later.toAt).getTime(),
          },
          project,
          owner,
        ),
      ),
    )

    expect(error.httpCode).to.equal(400)
    expect(error.message).to.contain('not already on an invoice')
    expect(await this.linesOf(first)).to.deep.equal(
      [earlier.id, later.id].sort(),
    )
    expect(await this.conn.getRepository(Invoice).count()).to.equal(1)
  }

  @test()
  /** A range that overlaps an invoice bills only what that invoice does not. */
  async create_rangePartlyOverAnInvoice_billsOnlyTheUninvoicedTime() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    const invoiced = await this.hourOfWork(project, owner, 5)
    const outstanding = await this.hourOfWork(project, owner, 3)

    const first = await runPromise(
      this.invoiceManager.createFromTimeIds(project, owner, [invoiced.id]),
    )

    const second = await runPromise(
      this.invoiceManager.create(
        {
          fromUnix: new Date(invoiced.fromAt).getTime(),
          toUnix: new Date(outstanding.toAt).getTime(),
        },
        project,
        owner,
      ),
    )

    // One hour at $60/hour, not two.
    expect(second.amountCents).to.equal(6000)
    expect(await this.linesOf(second)).to.deep.equal([outstanding.id])
    expect(await this.linesOf(first)).to.deep.equal([invoiced.id])

    const reloadedFirst = await this.conn
      .getRepository(Invoice)
      .findOneByOrFail({ id: first.id })
    expect(reloadedFirst.amountCents).to.equal(6000)
  }

  @test()
  /**
   * The link is enforced on the write, not only on the read before it: an
   * entry already on an invoice is never moved to another, whatever the
   * caller read.
   */
  async claimForInvoice_neverMovesAnEntryOffItsInvoice() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    const entry = await this.hourOfWork(project, owner, 5)
    const other = await this.hourOfWork(project, owner, 3)

    const first = await runPromise(
      this.invoiceManager.createFromTimeIds(project, owner, [entry.id]),
    )
    const second = await runPromise(
      this.invoiceManager.createFromTimeIds(project, owner, [other.id]),
    )

    const claimed = await runPromise(
      this.timeRepository.claimForInvoice(second, [entry]),
    )

    expect(claimed).to.equal(0)
    expect(await this.linesOf(first)).to.deep.equal([entry.id])
    expect(await this.linesOf(second)).to.deep.equal([other.id])
  }
}
