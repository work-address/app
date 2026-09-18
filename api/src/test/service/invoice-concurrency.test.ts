import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import moment from 'moment'
import { HttpError } from 'routing-controllers'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { ConcurrentCalls } from '@/test/fixture/concurrent-calls'
import { Invoice } from '@/entity/invoice'
import { Project } from '@/entity/project'
import { Time } from '@/entity/time'
import { User } from '@/entity/user'
import { InvoiceManager } from '@/service/invoice-manager'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { TimeFixture } from '@/test/fixture/time-fixture'
import { TimeRepository } from '@/repository/time-repository'
import { runPromise } from '@/service/effect-bridge'

/**
 * Invoices raised at the same moment, in every creation mode.
 *
 * Each mode reads the entries it may bill and then links them. Without a lock
 * between the two, concurrent requests all read the same free entries and all
 * bill them: one invoice ends up with the lines, the others with an amount
 * and nothing behind it. These run the modes side by side and check the one
 * invariant that matters - every invoice's amount is exactly the cost of its
 * own lines, so no hour is billed twice.
 */
@suite()
export class InvoiceConcurrencyTest extends AbstractDatabaseIntegration {
  protected projectFixture: ProjectFixture
  protected timeFixture: TimeFixture
  protected invoiceManager: InvoiceManager
  protected timeRepository: TimeRepository

  constructor() {
    super()

    this.projectFixture = this.container.get('ProjectFixture')
    this.timeFixture = this.container.get('TimeFixture')
    this.invoiceManager = this.container.get('InvoiceManager')
    this.timeRepository = this.container.get('TimeRepository')
  }

  private async setup(entryCount: number) {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 60)
    const entries: Time[] = []

    // One instant, and every entry an hour-long slot back from it.
    const now = moment.utc()

    for (let slot = entryCount; slot >= 1; slot -= 1) {
      entries.push(await this.hourOfWork(project, owner, now, slot * 2))
    }

    return { owner, project, entries }
  }

  private async hourOfWork(
    project: Project,
    author: User,
    now: moment.Moment,
    hoursAgo: number,
  ): Promise<Time> {
    const fromAt = now.clone().subtract(hoursAgo, 'hours')
    const time = await this.timeFixture.create(
      project,
      fromAt.toDate(),
      fromAt.clone().add(1, 'hour').toDate(),
      author,
    )

    time.minutesActive = 60

    return runPromise(this.timeRepository.saveSingle(time))
  }

  /** From the start of `first` to the end of `last`. */
  private range(first: Time, last: Time) {
    return {
      fromUnix: new Date(first.fromAt).getTime(),
      toUnix: new Date(last.toAt).getTime(),
    }
  }

  /**
   * Every invoice bills exactly its own lines, and each entry is on at most
   * one of them - so the total billed is each hour once.
   */
  private async expectEachHourBilledOnce(entries: Time[]) {
    const invoices = await this.conn.getRepository(Invoice).find()
    let linked = 0

    for (const invoice of invoices) {
      const lines = await runPromise(
        this.timeRepository.findForInvoice(invoice),
      )

      expect(invoice.amountCents, `invoice ${invoice.id}`).to.equal(
        InvoiceManager.amountFor(lines, 60),
      )
      linked += lines.length
    }

    const billed = invoices.reduce(
      (sum, invoice) => sum + invoice.amountCents,
      0,
    )

    expect(linked).to.be.at.most(entries.length)
    expect(billed).to.equal(linked * 6000)

    return { invoices, linked }
  }

  private expectOnlyNothingLeftRefusals(
    results: PromiseSettledResult<unknown>[],
  ) {
    for (const result of results) {
      if (result.status === 'rejected') {
        expect((result.reason as HttpError).httpCode).to.equal(400)
      }
    }
  }

  @test()
  async parallelRanges_overTheSameWindow_billItOnce() {
    const { owner, project, entries } = await this.setup(2)
    const [first, last] = entries

    const results = await new ConcurrentCalls(this.conn).settle(
      [1, 2, 3].map(
        () => () =>
          runPromise(
            this.invoiceManager.create(this.range(first, last), project, owner),
          ),
      ),
    )

    expect(results.filter((r) => r.status === 'fulfilled')).to.have.length(1)
    this.expectOnlyNothingLeftRefusals(results)

    const { invoices, linked } = await this.expectEachHourBilledOnce(entries)
    expect(invoices).to.have.length(1)
    expect(linked).to.equal(2)
  }

  @test()
  async parallelSelections_ofTheSameEntries_billThemOnce() {
    const { owner, project, entries } = await this.setup(2)
    const ids = entries.map((time) => time.id)

    const results = await new ConcurrentCalls(this.conn).settle(
      [1, 2, 3].map(
        () => () =>
          runPromise(
            this.invoiceManager.createFromTimeIds(project, owner, ids),
          ),
      ),
    )

    expect(results.filter((r) => r.status === 'fulfilled')).to.have.length(1)
    this.expectOnlyNothingLeftRefusals(results)

    const { invoices, linked } = await this.expectEachHourBilledOnce(entries)
    expect(invoices).to.have.length(1)
    expect(linked).to.equal(2)
  }

  /**
   * All three modes at once, over overlapping entries. Whichever order the
   * database settles them in, each hour lands on exactly one invoice - and
   * since "everything outstanding" is among them, every hour lands somewhere.
   */
  @test()
  async everyModeAtOnce_billsEachHourExactlyOnce() {
    const { owner, project, entries } = await this.setup(4)
    const [first, second, third, fourth] = entries

    const results = await new ConcurrentCalls(this.conn).settle<unknown>([
      () =>
        runPromise(
          this.invoiceManager.create(this.range(first, second), project, owner),
        ),
      () =>
        runPromise(
          this.invoiceManager.createFromTimeIds(project, owner, [
            second.id,
            third.id,
          ]),
        ),
      () => runPromise(this.invoiceManager.ensureForProject(project, owner)),
      () =>
        runPromise(
          this.invoiceManager.createFromTimeIds(project, owner, [
            third.id,
            fourth.id,
          ]),
        ),
    ])

    this.expectOnlyNothingLeftRefusals(results)

    const { linked } = await this.expectEachHourBilledOnce(entries)
    expect(linked).to.equal(entries.length)
  }
}
