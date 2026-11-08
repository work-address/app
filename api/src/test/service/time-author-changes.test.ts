import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import moment from 'moment'

import { getDataSource } from '@/connector/data-source'
import { AppUsage } from '@/entity/app-usage'
import { Invoice } from '@/entity/invoice'
import { Project } from '@/entity/project'
import { Time } from '@/entity/time'
import { User } from '@/entity/user'
import AccessException from '@/exception/access-exception'
import InvoicedTimeException from '@/exception/invoiced-time-exception'
import { TimeCreateDto } from '@/model/dto/time'
import { EInvoiceState } from '@/model/invoice'
import { EProjectState } from '@/model/project'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeRepository } from '@/repository/time-repository'
import { runPromise } from '@/service/effect-bridge'
import { InvoiceManager } from '@/service/invoice-manager'
import { TimeManager } from '@/service/time-manager'
import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { TimeFixture } from '@/test/fixture/time-fixture'
import { UserFixture } from '@/test/fixture/user-fixture'

/** What an author may change on an entry after it is recorded. */
@suite()
export class TimeAuthorChangesTest extends AbstractDatabaseIntegration {
  protected userFixture: UserFixture
  protected projectFixture: ProjectFixture
  protected timeFixture: TimeFixture
  protected timeManager: TimeManager
  protected timeRepository: TimeRepository
  protected projectRepository: ProjectRepository
  protected invoiceManager: InvoiceManager
  protected invoiceRepository: InvoiceRepository

  constructor() {
    super()

    this.userFixture = this.container.get('UserFixture')
    this.projectFixture = this.container.get('ProjectFixture')
    this.timeFixture = this.container.get('TimeFixture')
    this.timeManager = this.container.get('TimeManager')
    this.timeRepository = this.container.get('TimeRepository')
    this.projectRepository = this.container.get('ProjectRepository')
    this.invoiceManager = this.container.get('InvoiceManager')
    this.invoiceRepository = this.container.get('InvoiceRepository')
  }

  private async scenario() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    project.rateHour = 60
    await runPromise(this.projectRepository.saveSingle(project))

    const entry = (minutesAgo: number, author = worker) =>
      this.timeFixture.create(
        project,
        moment.utc().subtract(minutesAgo, 'minutes').toDate(),
        moment
          .utc()
          .subtract(minutesAgo - 10, 'minutes')
          .toDate(),
        author,
      )

    return { owner, worker, project, entry }
  }

  private read(id: string) {
    return runPromise(this.timeRepository.findOneBy({ where: { id } }))
  }

  private async refusal(run: () => Promise<unknown>): Promise<unknown> {
    try {
      await run()
    } catch (error: unknown) {
      return error
    }
    throw new Error('Expected the change to be refused')
  }

  @test()
  async aBatchWithSomeoneElsesEntryChangesNothing() {
    const { owner, worker, entry } = await this.scenario()
    const mine = await entry(120)
    const theirs = await entry(100, owner)

    const error = await this.refusal(() =>
      runPromise(
        this.timeManager.setIsPaidMany([mine.id, theirs.id], true, worker),
      ),
    )
    expect(error).to.be.instanceOf(AccessException)
    expect((await this.read(mine.id))!.isPaid).to.not.equal(true)

    expect(
      await this.refusal(() =>
        runPromise(this.timeManager.removeMany([mine.id, theirs.id], worker)),
      ),
    ).to.be.instanceOf(AccessException)
    expect(await this.read(mine.id)).to.exist
  }

  @test()
  async onlyItsAuthorCanEditAnEntry() {
    const { owner, entry } = await this.scenario()
    const time = await entry(120)

    expect(
      await this.refusal(() =>
        runPromise(
          this.timeManager.edit(
            time.id,
            Object.assign(new Time(), { note: 'rewritten' }),
            owner,
          ),
        ),
      ),
    ).to.be.instanceOf(AccessException)
    expect((await this.read(time.id))!.note).to.equal(time.note)
  }

  /** A loaded copy going stale can't matter: only the named column is written. */
  @test()
  async aChangeTouchesOnlyItsOwnColumns() {
    const { worker, entry } = await this.scenario()
    const time = await entry(120)
    const before = await this.read(time.id)

    await runPromise(this.timeManager.setIsPaidMany([time.id], true, worker))
    await runPromise(
      this.timeManager.edit(
        time.id,
        Object.assign(new Time(), { note: 'changed' }),
        worker,
      ),
    )

    const after = await this.read(time.id)
    expect(after!.isPaid).to.equal(true)
    expect(after!.note).to.equal('changed')
    expect(after!.minutesActive).to.equal(before!.minutesActive)
    expect(after!.keyboardKeys).to.equal(before!.keyboardKeys)
    expect(after!.mouseKeys).to.equal(before!.mouseKeys)
  }

  private note(note: string | null, isPaid?: boolean) {
    return Object.assign(new Time(), {
      note,
      ...(isPaid !== undefined && { isPaid }),
    })
  }

  private async invoiced(project: Project, worker: User, time: Time) {
    return runPromise(
      this.invoiceManager.createFromTimeIds(project, worker, [time.id]),
    )
  }

  /** An invoice from before lines were frozen, as old rows still are. */
  private async legacyInvoice(project: Project, time: Time, issuer?: User) {
    const invoice = new Invoice()
    invoice.project = project
    invoice.user = issuer
    invoice.fromAt = moment(time.fromAt).subtract(1, 'minute').toDate()
    invoice.toAt = moment(time.toAt).add(1, 'minute').toDate()
    invoice.amountCents = 100
    invoice.state = EInvoiceState.REQUESTED
    return runPromise(this.invoiceRepository.saveSingle(invoice))
  }

  @test()
  async anInvoicedEntryKeepsItsDetail() {
    const { worker, project, entry } = await this.scenario()
    const time = await entry(120)
    time.screenshot = 'kept'
    time.processes = [{ name: 'code', description: '', timeMin: 1 }]
    await runPromise(this.timeRepository.saveSingle(time))
    await getDataSource().manager.save(AppUsage, {
      time,
      identity: 'code',
      app: 'code',
      title: null,
      domain: null,
      seconds: 60,
    })
    await this.invoiced(project, worker, time)

    for (const refused of [
      this.timeManager.removeMany([time.id], worker),
      this.timeManager.removeScreenshots([time.id], worker),
      this.timeManager.removeProcesses([time.id], worker),
      this.timeManager.edit(time.id, this.note('rewritten'), worker),
    ]) {
      expect(await this.refusal(() => runPromise(refused))).to.be.instanceOf(
        InvoicedTimeException,
      )
    }

    const kept = await this.read(time.id)
    expect(kept!.screenshot).to.equal('kept')
    expect(kept!.processes).to.have.length(1)
    expect(kept!.note).to.equal(time.note)
    expect(
      await getDataSource().manager.count(AppUsage, {
        where: { time: { id: time.id } },
      }),
    ).to.equal(1)
  }

  @test()
  async anInvoicedEntrysPaidStateStillChangesByHand() {
    const { worker, project, entry } = await this.scenario()
    const time = await entry(120)
    await this.invoiced(project, worker, time)

    await runPromise(this.timeManager.setIsPaidMany([time.id], true, worker))
    expect((await this.read(time.id))!.isPaid).to.equal(true)

    // The web form always sends the note it was opened with.
    await runPromise(
      this.timeManager.edit(time.id, this.note(time.note, false), worker),
    )
    expect((await this.read(time.id))!.isPaid).to.equal(false)
  }

  /** The web form holds a missing note as a blank one. */
  @test()
  async aBlankNoteIsTheSameAsNoNote() {
    const { worker, project, entry } = await this.scenario()
    const time = await entry(120)
    time.note = null
    await runPromise(this.timeRepository.saveSingle(time))
    await this.invoiced(project, worker, time)

    await runPromise(
      this.timeManager.edit(time.id, this.note('', true), worker),
    )
    expect((await this.read(time.id))!.isPaid).to.equal(true)
  }

  @test()
  async aBatchWithAnInvoicedEntryChangesNothing() {
    const { worker, project, entry } = await this.scenario()
    const loose = await entry(200)
    loose.screenshot = 'kept'
    await runPromise(this.timeRepository.saveSingle(loose))
    const time = await entry(120)
    await this.invoiced(project, worker, time)

    expect(
      await this.refusal(() =>
        runPromise(this.timeManager.removeMany([loose.id, time.id], worker)),
      ),
    ).to.be.instanceOf(InvoicedTimeException)
    expect(await this.read(loose.id)).to.exist

    expect(
      await this.refusal(() =>
        runPromise(
          this.timeManager.removeScreenshots([loose.id, time.id], worker),
        ),
      ),
    ).to.be.instanceOf(InvoicedTimeException)
    expect((await this.read(loose.id))!.screenshot).to.equal('kept')
  }

  /** Someone else's entry is an access refusal, whatever is on an invoice. */
  @test()
  async notBeingTheAuthorComesBeforeBeingInvoiced() {
    const { owner, worker, project, entry } = await this.scenario()
    const time = await entry(120)
    await this.invoiced(project, worker, time)

    expect(
      await this.refusal(() =>
        runPromise(this.timeManager.removeMany([time.id], owner)),
      ),
    ).to.be.instanceOf(AccessException)
  }

  @test()
  async aRejectionReleasesTheEntry() {
    const { owner, worker, project, entry } = await this.scenario()
    const time = await entry(120)
    const invoice = await this.invoiced(project, worker, time)

    await runPromise(this.invoiceManager.reject(invoice, owner, 'not this'))

    await runPromise(
      this.timeManager.edit(time.id, this.note('rewritten'), worker),
    )
    expect((await this.read(time.id))!.note).to.equal('rewritten')
    await runPromise(this.timeManager.removeMany([time.id], worker))
    expect(await this.read(time.id)).to.be.undefined
  }

  /** The same line retention draws, including invoices with no frozen lines. */
  @test()
  async anOldInvoiceCoversWhatIsInsideItsPeriod() {
    const { worker, project, entry } = await this.scenario()
    const covered = await entry(120)
    const outside = await entry(600)
    await this.legacyInvoice(project, covered)

    expect(
      await this.refusal(() =>
        runPromise(this.timeManager.removeMany([covered.id], worker)),
      ),
    ).to.be.instanceOf(InvoicedTimeException)

    await runPromise(this.timeManager.removeMany([outside.id], worker))
    expect(await this.read(outside.id)).to.be.undefined
  }

  @test()
  async aColleaguesOldInvoiceDoesNotCoverAnAuthorsEntry() {
    const { owner, worker, project, entry } = await this.scenario()
    const time = await entry(120)
    await this.legacyInvoice(project, time, owner)

    await runPromise(this.timeManager.removeMany([time.id], worker))
    expect(await this.read(time.id)).to.be.undefined
  }

  /** The same as a run's prompt: having been seen doesn't freeze it. */
  @test()
  async publishedDetailCanStillBeRemovedUntilInvoiced() {
    const { worker, entry } = await this.scenario()
    const time = await entry(120)
    time.screenshot = 'seen'
    await runPromise(this.timeRepository.saveSingle(time))
    await runPromise(this.timeManager.publish([time.id], worker))

    await runPromise(this.timeManager.removeScreenshots([time.id], worker))
    expect((await this.read(time.id))!.screenshot).to.equal(null)
  }

  /** Inside the review window, so only publishing can publish it. */
  private recentSlot() {
    return moment.utc().subtract(2, 'hours').startOf('minute')
  }

  private upload(project: Project, note: string, fromAt: moment.Moment) {
    return {
      fromIndex: 1,
      toIndex: 2,
      note,
      keyboardKeys: 3,
      minutesActive: 4,
      mouseKeys: 3,
      mouseDistance: 5,
      fromAt: fromAt.toISOString(),
      toAt: fromAt.clone().add(10, 'minutes').toISOString(),
      projectId: project.id,
    } as unknown as TimeCreateDto
  }

  /** The desktop retries an upload with the note it first sent. */
  @test()
  async aRetryCannotUndoACorrectedNoteOncePublished() {
    const { worker, project } = await this.scenario()
    const slot = this.recentSlot()
    const [saved] = await runPromise(
      this.timeManager.createOrUpdateMany(
        [this.upload(project, 'first', slot)],
        worker,
      ),
    )

    await runPromise(this.timeManager.publish([saved.id!], worker))
    await runPromise(
      this.timeManager.edit(saved.id!, this.note('corrected'), worker),
    )

    const [retried] = await runPromise(
      this.timeManager.createOrUpdateMany(
        [this.upload(project, 'first', slot)],
        worker,
      ),
    )

    expect(retried.error).to.be.undefined
    expect(retried.note).to.equal('first')
    expect((await this.read(saved.id!))!.note).to.equal('corrected')
  }

  @test()
  async aRetryStillReplacesTheNoteBeforePublication() {
    const { worker, project } = await this.scenario()
    const slot = this.recentSlot()
    const [saved] = await runPromise(
      this.timeManager.createOrUpdateMany(
        [this.upload(project, 'first', slot)],
        worker,
      ),
    )

    await runPromise(
      this.timeManager.createOrUpdateMany(
        [this.upload(project, 'second', slot)],
        worker,
      ),
    )

    expect((await this.read(saved.id!))!.note).to.equal('second')
  }
}
