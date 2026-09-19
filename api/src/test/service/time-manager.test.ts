import { expect } from 'chai'
import moment from 'moment'
import { suite, test } from '@testdeck/mocha'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { ConcurrentCalls } from '@/test/fixture/concurrent-calls'
import { InvoiceManager } from '@/service/invoice-manager'
import { TimeManager } from '@/service/time-manager'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeFixture } from '@/test/fixture/time-fixture'
import { TimeRepository } from '@/repository/time-repository'
import AccessException from '@/exception/access-exception'
import { EProjectState } from '@/model/project'
import { TimeCreateDto } from '@/model/dto/time'
import { ITimeInsertionResult } from '@/model/time'
import { Invoice } from '@/entity/invoice'
import { Time } from '@/entity/time'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { UserManager } from '@/service/user-manager'
import { EInvoiceState } from '@/model/invoice'
import { runPromise } from '@/service/effect-bridge'

@suite()
export class TimeManagerTest extends AbstractDatabaseIntegration {
  /**
   * Days ago that is comfortably outside the free-tier retention window,
   * derived from the constant rather than hardcoded. These tests previously
   * pinned literals chosen against a 7-day window and silently stopped
   * exercising the purge when the window widened to 14.
   */
  private static staleDays(offset: number = 1): number {
    return TimeManager.freeTimeLogRetentionDays + offset
  }

  protected timeManager: TimeManager
  protected projectFixture: ProjectFixture
  protected projectRepository: ProjectRepository
  protected timeFixture: TimeFixture
  protected timeRepository: TimeRepository
  protected invoiceRepository: InvoiceRepository
  protected userManager: UserManager

  constructor() {
    super()
    this.timeManager = this.container.get('TimeManager')
    this.projectFixture = this.container.get('ProjectFixture')
    this.projectRepository = this.container.get('ProjectRepository')
    this.timeFixture = this.container.get('TimeFixture')
    this.timeRepository = this.container.get('TimeRepository')
    this.invoiceRepository = this.container.get('InvoiceRepository')
    this.userManager = this.container.get('UserManager')
  }

  private buildTimePayload(
    projectId: string,
    userSuffix: number,
  ): TimeCreateDto {
    // One clock read, both ends derived from it: an exact ten-minute slice.
    const toAt = moment.utc()
    const fromAt = toAt.clone().subtract(10, 'minutes')

    return {
      fromIndex: userSuffix,
      toIndex: userSuffix + 1,
      note: `entry-${userSuffix}`,
      keyboardKeys: 1,
      minutesActive: 10,
      mouseKeys: 1,
      mouseDistance: 1,
      fromAt: fromAt.toISOString(),
      toAt: toAt.toISOString(),
      projectId,
    }
  }

  @test()
  async createOrUpdateMany_savesTimeForWorkerOnActiveProject() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const [result] = await runPromise(
      this.timeManager.createOrUpdateMany(
        [this.buildTimePayload(project.id, 1)],
        worker,
      ),
    )

    expect(result.error).to.be.undefined
    expect(result.id).to.be.a('string')
  }

  @test()
  async createOrUpdateMany_returnsErrorForViewerOnSharedProject() {
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

    const [result] = await runPromise(
      this.timeManager.createOrUpdateMany(
        [this.buildTimePayload(project.id, 2)],
        viewer,
      ),
    )

    expect(result.error).to.exist
    expect(result.error?.name).to.be.equal('EntityNotFoundError')
    expect(result.id).to.be.undefined
  }

  @test()
  async createOrUpdateMany_returnsErrorWhenProjectInactive() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.INACTIVE,
    )
    project.workerAddresses = [worker.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const [result] = await runPromise(
      this.timeManager.createOrUpdateMany(
        [this.buildTimePayload(project.id, 3)],
        worker,
      ),
    )

    expect(result.error).to.exist
    expect(result.error?.name).to.be.equal('EntityNotFoundError')
  }

  /**
   * Every other case here sends a one-entry batch, which never exercised the
   * reason this method handles entries individually: a tracker syncs several at
   * once, and one bad entry has to come back as an error in its own slot while
   * its neighbours are still stored.
   */
  @test()
  async createOrUpdateMany_keepsGoodEntriesWhenOneInTheBatchFails() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    // Distinct windows so the entries cannot collide with each other on
    // (project, fromAt, toAt) and update in place instead of inserting.
    const shift = (payload: TimeCreateDto, minutes: number): TimeCreateDto => ({
      ...payload,
      fromAt: moment.utc(payload.fromAt).subtract(minutes, 'm').toISOString(),
      toAt: moment.utc(payload.toAt).subtract(minutes, 'm').toISOString(),
    })

    const batch = [
      shift(this.buildTimePayload(project.id, 60), 0),
      // Unknown project: findProjectForTimeTracking raises EntityNotFoundError.
      shift(
        this.buildTimePayload('d650ad83-eab3-4200-9bf2-479a47c59892', 61),
        30,
      ),
      shift(this.buildTimePayload(project.id, 62), 60),
    ]

    const results = await runPromise(
      this.timeManager.createOrUpdateMany(batch, owner),
    )

    expect(results.length).to.be.equal(3)

    // Results stay aligned with the submitted order - the tracker reconciles
    // its local rows positionally, so a dropped or reordered slot corrupts it.
    expect(results.map((result) => result.note)).to.deep.equal(
      batch.map((payload) => payload.note),
    )

    expect(results[0].error).to.be.undefined
    expect(results[0].id).to.be.a('string')

    expect(results[1].error).to.exist
    expect(results[1].error?.name).to.be.equal('EntityNotFoundError')
    expect(results[1].id).to.be.undefined

    expect(results[2].error).to.be.undefined
    expect(results[2].id).to.be.a('string')

    // The two good entries are actually persisted, not just reported as such.
    const stored = await runPromise(
      this.timeRepository.findBy({
        where: { project: { id: project.id } },
      }),
    )
    expect(stored.length).to.be.equal(2)
  }

  /**
   * The method returns an Effect - a description, not work already in flight -
   * so running one twice must behave like running two.
   *
   * It used to capture the retention cutoff and the set of projects to purge
   * when the effect was *built*. A second run of the same effect therefore
   * inherited the first run's bookkeeping and would purge a project the second
   * run never touched. This drives that difference: the project is deactivated
   * between the runs, so the second run registers nothing of its own, and a
   * leaked set is the only thing that could delete the entry added in between.
   */
  @test()
  async createOrUpdateMany_effectCarriesNoRetentionStateBetweenRuns() {
    const owner = await this.userFixture.createUser() // free tier
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    // Built once, run twice - the point of the test.
    const effect = this.timeManager.createOrUpdateMany(
      [this.buildTimePayload(project.id, 70)],
      owner,
    )

    const [firstResult] = await runPromise(effect)
    expect(firstResult.error, 'first run should store the entry').to.be
      .undefined

    // Added after the first run, so only a purge triggered by the *second* run
    // could remove it.
    const staleFrom = moment
      .utc()
      .subtract(TimeManagerTest.staleDays(), 'days')
      .toDate()
    const stale = await this.timeFixture.create(
      project,
      staleFrom,
      moment.utc(staleFrom).add(10, 'minutes').toDate(),
    )

    // Deactivating the project makes the second run fail its project lookup, so
    // it registers nothing for retention on its own.
    project.state = EProjectState.INACTIVE
    await runPromise(this.projectRepository.saveSingle(project))

    const [secondResult] = await runPromise(effect)
    expect(secondResult.error?.name).to.be.equal('EntityNotFoundError')

    // The backlogged entry survives: the second run had no project of its own
    // under retention, so it must not have purged anything.
    const survivor = await runPromise(
      this.timeRepository.findOneBy({ where: { id: stale.id } }),
    )
    expect(survivor, 'second run purged a project it never touched').to.exist
  }

  /**
   * G2. Every tracker aligns to the same ten-minute buckets, so two people
   * tracking one project at the same time send the same slice. The key used
   * to be (project, fromAt): the second author was refused with "Wrong user"
   * and their tracker dropped the row for good. Each author now keeps their
   * own row, and the project's totals count both.
   */
  @test()
  async createOrUpdateMany_twoWorkersPostingTheSameSlice_bothKeepTheirRows() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const otherWorker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address, otherWorker.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const payload = this.buildTimePayload(project.id, 4)
    const [first] = await runPromise(
      this.timeManager.createOrUpdateMany([payload], worker),
    )
    const [second] = await runPromise(
      this.timeManager.createOrUpdateMany(
        [
          {
            ...payload,
            note: 'the other worker',
            minutesActive: 6,
            keyboardKeys: 40,
          },
        ],
        otherWorker,
      ),
    )

    expect(first.error).to.be.undefined
    expect(second.error).to.be.undefined
    expect(first.id).to.be.a('string')
    expect(second.id).to.be.a('string')
    expect(second.id).to.not.equal(first.id)

    const stored = await this.conn.getRepository(Time).find({
      where: { project: { id: project.id } },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    })

    expect(
      stored.map((row) => [row.user.id, row.note, row.minutesActive]),
    ).to.deep.equal([
      [worker.id, payload.note, payload.minutesActive],
      [otherWorker.id, 'the other worker', 6],
    ])

    const [totals] = await runPromise(
      this.timeRepository.getTotals(owner, project.id),
    )

    expect(totals.minutesActive).to.equal(payload.minutesActive + 6)
    expect(totals.keyboardKeys).to.equal(payload.keyboardKeys + 40)
  }

  /** The same author re-sending a slice updates their row; no second one. */
  @test()
  async createOrUpdateMany_sameAuthorRepostingASlice_updatesTheirOwnRow() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const payload = this.buildTimePayload(project.id, 5)
    const [ownerRow] = await runPromise(
      this.timeManager.createOrUpdateMany([payload], owner),
    )
    const [first] = await runPromise(
      this.timeManager.createOrUpdateMany([payload], worker),
    )
    const [again] = await runPromise(
      this.timeManager.createOrUpdateMany(
        [{ ...payload, note: 'resent', minutesActive: 9 }],
        worker,
      ),
    )

    expect(again.error).to.be.undefined
    expect(again.id).to.equal(first.id)

    const stored = await this.conn.getRepository(Time).find({
      where: { project: { id: project.id } },
      relations: { user: true },
    })
    const byAuthor = new Map(stored.map((row) => [row.user.id, row]))

    expect(stored.length).to.equal(2)
    expect(byAuthor.get(worker.id)?.id).to.equal(first.id)
    expect(byAuthor.get(worker.id)?.note).to.equal('resent')
    expect(byAuthor.get(worker.id)?.minutesActive).to.equal(9)
    // The owner's row for the same slice is theirs and untouched.
    expect(byAuthor.get(owner.id)?.id).to.equal(ownerRow.id)
    expect(byAuthor.get(owner.id)?.note).to.equal(payload.note)
  }

  /**
   * The key itself: the database refuses a second row for one author and
   * slice, and accepts one from another author. Written past the manager,
   * so it is the constraint answering and not the lookup.
   */
  @test()
  async timeUniqueKey_isProjectAuthorAndFromAt() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const now = moment.utc()
    const fromAt = now.clone().subtract(10, 'minutes').toDate()
    const toAt = now.toDate()

    await this.timeFixture.create(project, fromAt, toAt, owner)
    await this.timeFixture.create(project, fromAt, toAt, worker)

    let error: unknown

    try {
      await this.timeFixture.create(project, fromAt, toAt, worker)
    } catch (e: unknown) {
      error = e
    }

    expect((error as { driverError?: { constraint?: string } }).driverError)
      .to.have.property('constraint')
      .equal('UQ_TIME_PROJECT_USER_FROM_AT')
  }

  /**
   * REC-09. Invoices bill `minutesActive`, and escrow pays those invoices,
   * so what one row may claim is bounded on the server. Every rule broken is
   * refused in that row's own slot, with the rule named; the valid rows of
   * the same batch - the edge of each bound included - are stored.
   */
  @test()
  async createOrUpdateMany_outOfBoundsRows_areRefusedOneByOne_whileValidOnesPersist() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    // One instant; every slice is placed relative to it.
    const now = moment.utc()
    const row = (
      note: string,
      fromAt: moment.Moment,
      toAt: moment.Moment,
      values: Partial<TimeCreateDto> = {},
    ): TimeCreateDto => ({
      fromIndex: 1,
      toIndex: 2,
      note,
      keyboardKeys: 1,
      minutesActive: 5,
      mouseKeys: 1,
      mouseDistance: 1,
      fromAt: fromAt.toISOString(),
      toAt: toAt.toISOString(),
      projectId: project.id,
      ...values,
    })
    const hoursAgo = (hours: number) => now.clone().subtract(hours, 'hours')
    const slice = (note: string, hours: number, values = {}) =>
      row(note, hoursAgo(hours), hoursAgo(hours).add(10, 'minutes'), values)

    const batch = [
      slice('every minute active', 1, { minutesActive: 10 }),
      slice('negative minutes', 2, { minutesActive: -1 }),
      slice('more minutes than the slice', 3, { minutesActive: 11 }),
      row('a full hour', hoursAgo(4), hoursAgo(4).add(60, 'minutes'), {
        minutesActive: 60,
      }),
      slice('negative keys', 5, { keyboardKeys: -1 }),
      slice('negative clicks', 6, { mouseKeys: -1 }),
      slice('negative distance', 7, { mouseDistance: -0.5 }),
      slice('nothing at all', 8, {
        minutesActive: 0,
        keyboardKeys: 0,
        mouseKeys: 0,
        mouseDistance: 0,
      }),
      row('ends as it starts', hoursAgo(9), hoursAgo(9), { minutesActive: 0 }),
      row(
        'ends before it starts',
        hoursAgo(10),
        hoursAgo(10).subtract(5, 'm'),
        {
          minutesActive: 0,
        },
      ),
      row('over an hour', hoursAgo(11), hoursAgo(11).add(61, 'minutes')),
      row(
        'ends within the skew',
        now.clone().subtract(6, 'minutes'),
        now.clone().add(4, 'minutes'),
      ),
    ]

    const results = await runPromise(
      this.timeManager.createOrUpdateMany(batch, owner),
    )

    const refused = (property: string, rule: string) => ({
      name: 'ConstraintsValidationException',
      errors: [{ property, rules: [rule] }],
    })
    const outcome = results.map((result) =>
      result.error
        ? {
            name: result.error.name,
            errors: (
              result.error.errors as {
                property: string
                constraints: Record<string, string>
              }[]
            ).map((error) => ({
              property: error.property,
              rules: Object.keys(error.constraints),
            })),
          }
        : 'stored',
    )

    expect(outcome).to.deep.equal([
      'stored',
      refused('minutesActive', 'min'),
      refused('minutesActive', 'maxSpanMinutes'),
      'stored',
      refused('keyboardKeys', 'min'),
      refused('mouseKeys', 'min'),
      refused('mouseDistance', 'min'),
      'stored',
      refused('toAt', 'isAfterFromAt'),
      refused('toAt', 'isAfterFromAt'),
      refused('toAt', 'maxSpan'),
      'stored',
    ])
    expect(results.map((result) => result.note)).to.deep.equal(
      batch.map((payload) => payload.note),
    )
    for (const result of results) {
      expect(result.id === undefined, String(result.note)).to.equal(
        Boolean(result.error),
      )
    }

    // What is stored is exactly the valid rows - nothing refused slipped in.
    const stored = await this.conn.getRepository(Time).find({
      where: { project: { id: project.id } },
    })

    expect(stored.map((time) => time.note).sort()).to.deep.equal(
      [
        'every minute active',
        'a full hour',
        'nothing at all',
        'ends within the skew',
      ].sort(),
    )
  }

  /**
   * The desktop tracker sends its ten-minute bucket with `toAt` at the
   * bucket's planned end, and uploads the bucket still in progress on Stop,
   * at start-up and on a token refresh. A refusal there is final on the
   * desktop - it marks the rows failed and never sends them again - so the
   * future bound is on what the row claims: a slice may not start past the
   * skew allowance, and its active minutes may not reach past it. The
   * in-progress bucket is stored; minutes not yet worked are not.
   */
  @test()
  async createOrUpdateMany_bucketInProgress_isStored_butNotMinutesYetToCome() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    // One instant; every slice is placed relative to it. The server reads
    // its own clock a moment later, which only widens what has elapsed.
    const now = moment.utc()
    const bucket = (
      note: string,
      fromAt: moment.Moment,
      minutesActive: number,
    ): TimeCreateDto => ({
      fromIndex: 1,
      toIndex: 2,
      note,
      keyboardKeys: 1,
      minutesActive,
      mouseKeys: 1,
      mouseDistance: 1,
      fromAt: fromAt.toISOString(),
      toAt: fromAt.clone().add(10, 'minutes').toISOString(),
      projectId: project.id,
    })
    const twoMinutesIn = now.clone().subtract(2, 'minutes')

    const batch = [
      // Stopped two minutes into the bucket: toAt is eight minutes ahead.
      bucket('stopped two minutes in', twoMinutesIn, 2),
      // The same bucket claiming nine minutes: at most seven have passed,
      // skew included. Refused, and the stored row keeps its two.
      bucket('minutes not yet worked', twoMinutesIn, 9),
      // A tracker clock a few minutes ahead of the server's.
      bucket('starts within the skew', now.clone().add(4, 'minutes'), 1),
      bucket('starts in the future', now.clone().add(10, 'minutes'), 0),
    ]

    const results = await runPromise(
      this.timeManager.createOrUpdateMany(batch, owner),
    )

    expect(
      results.map((result) =>
        result.error
          ? (
              result.error.errors as {
                property: string
                constraints: Record<string, string>
              }[]
            ).map((error) => ({
              property: error.property,
              rules: Object.keys(error.constraints),
            }))
          : 'stored',
      ),
    ).to.deep.equal([
      'stored',
      [{ property: 'minutesActive', rules: ['maxElapsedMinutes'] }],
      'stored',
      [{ property: 'fromAt', rules: ['notInFuture'] }],
    ])

    const stored = await this.conn.getRepository(Time).find({
      where: { project: { id: project.id } },
      order: { fromAt: 'ASC' },
    })

    expect(
      stored.map((time) => ({
        note: time.note,
        minutesActive: time.minutesActive,
        toAt: time.toAt.toISOString(),
      })),
    ).to.deep.equal([
      {
        note: 'stopped two minutes in',
        minutesActive: 2,
        toAt: batch[0].toAt,
      },
      {
        note: 'starts within the skew',
        minutesActive: 1,
        toAt: batch[2].toAt,
      },
    ])
  }

  /**
   * Re-sending a slice that is already stored, with values out of bounds,
   * is refused like a new one - and the stored row keeps what it had.
   */
  @test()
  async createOrUpdateMany_outOfBoundsResend_leavesTheStoredRowAlone() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const payload = this.buildTimePayload(project.id, 80)

    const [first] = await runPromise(
      this.timeManager.createOrUpdateMany([payload], owner),
    )
    const [resent] = await runPromise(
      this.timeManager.createOrUpdateMany(
        [{ ...payload, minutesActive: 600, note: 'inflated' }],
        owner,
      ),
    )

    expect(first.id).to.be.a('string')
    expect(resent.id).to.be.undefined
    expect(resent.error?.name).to.equal('ConstraintsValidationException')

    const row = await this.conn
      .getRepository(Time)
      .findOneOrFail({ where: { id: first.id } })

    expect([row.minutesActive, row.note]).to.deep.equal([
      payload.minutesActive,
      payload.note,
    ])
  }

  /**
   * REC-02. An entry an invoice bills is the evidence for money asked for.
   * The partial-bucket re-upload used to rewrite its minutes and counters
   * under the issued invoice. It is now refused for that row alone, naming
   * the invoice and what would have changed; the row stays as billed, and
   * the other rows of the batch are stored.
   */
  @test()
  async createOrUpdateMany_resendOverAnInvoicedRow_isRefusedAndLeavesItUnchanged() {
    const invoiceManager: InvoiceManager = this.container.get('InvoiceManager')
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 20)
    const payload = this.buildTimePayload(project.id, 81)
    const next = {
      ...payload,
      note: 'the next slice',
      fromAt: moment.utc(payload.fromAt).subtract(1, 'hour').toISOString(),
      toAt: moment.utc(payload.toAt).subtract(1, 'hour').toISOString(),
    }

    const [billed] = await runPromise(
      this.timeManager.createOrUpdateMany(
        [{ ...payload, minutesActive: 9 }],
        owner,
      ),
    )
    const invoice = await runPromise(
      invoiceManager.ensureForProject(project, owner),
    )

    expect(invoice?.id).to.be.a('string')

    const [resent, fresh] = await runPromise(
      this.timeManager.createOrUpdateMany(
        [
          { ...payload, minutesActive: 3, keyboardKeys: 99, note: 'rewritten' },
          next,
        ],
        owner,
      ),
    )

    expect(resent.id).to.be.undefined
    expect(resent.error?.name).to.equal('InvoicedTimeException')
    expect(resent.error?.message)
      .to.contain(invoice!.id)
      .and.contain('note, minutesActive, keyboardKeys')
    expect(fresh.error).to.be.undefined
    expect(fresh.id).to.be.a('string')

    const row = await this.conn
      .getRepository(Time)
      .findOneOrFail({ where: { id: billed.id } })

    expect({
      invoiceId: row.invoiceId,
      toAt: row.toAt.toISOString(),
      note: row.note,
      minutesActive: row.minutesActive,
      keyboardKeys: row.keyboardKeys,
      mouseKeys: row.mouseKeys,
      mouseDistance: row.mouseDistance,
    }).to.deep.equal({
      invoiceId: invoice!.id,
      toAt: payload.toAt,
      note: payload.note,
      minutesActive: 9,
      keyboardKeys: payload.keyboardKeys,
      mouseKeys: payload.mouseKeys,
      mouseDistance: payload.mouseDistance,
    })
  }

  /**
   * A tracker that retries sends the same values again. Over an invoiced
   * row that changes nothing, so it is answered with the row's id rather
   * than an error the tracker would record as a failed sync.
   */
  @test()
  async createOrUpdateMany_identicalResendOverAnInvoicedRow_answersWithItsId() {
    const invoiceManager: InvoiceManager = this.container.get('InvoiceManager')
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner, 20)
    const payload = this.buildTimePayload(project.id, 82)

    const [billed] = await runPromise(
      this.timeManager.createOrUpdateMany([payload], owner),
    )
    await runPromise(invoiceManager.ensureForProject(project, owner))

    const [again] = await runPromise(
      this.timeManager.createOrUpdateMany([payload], owner),
    )

    expect(again.error).to.be.undefined
    expect(again.id).to.equal(billed.id)
  }

  /** A row marked paid by hand is settled too, and a re-sync cannot change it. */
  @test()
  async createOrUpdateMany_resendOverAPaidRow_isRefusedAndLeavesItUnchanged() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const payload = this.buildTimePayload(project.id, 83)

    const [paid] = await runPromise(
      this.timeManager.createOrUpdateMany([payload], owner),
    )
    await runPromise(this.timeManager.setIsPaidMany([paid.id!], true, owner))

    const [resent] = await runPromise(
      this.timeManager.createOrUpdateMany(
        [{ ...payload, minutesActive: 2 }],
        owner,
      ),
    )

    expect(resent.id).to.be.undefined
    expect(resent.error?.name).to.equal('InvoicedTimeException')
    expect(resent.error?.message).to.contain('marked paid')

    const row = await this.conn
      .getRepository(Time)
      .findOneOrFail({ where: { id: paid.id } })

    expect([row.isPaid, row.minutesActive]).to.deep.equal([
      true,
      payload.minutesActive,
    ])
  }

  /**
   * The check and the write happen with the row locked. Here an invoice
   * holds the row while a re-upload arrives, and claims it before letting
   * go. The re-upload waits, then sees the claim and is refused. Without the
   * lock it read the row as unbilled, waited only at its write, then
   * rewrote the row the invoice had just billed.
   */
  @test()
  async createOrUpdateMany_resendWaitingOnAnInvoiceClaim_seesTheClaim() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const payload = this.buildTimePayload(project.id, 84)
    const [tracked] = await runPromise(
      this.timeManager.createOrUpdateMany([payload], owner),
    )

    const invoice = new Invoice()
    invoice.project = project
    invoice.fromAt = moment.utc(payload.fromAt).toDate()
    invoice.toAt = moment.utc(payload.toAt).toDate()
    invoice.amountCents = 0
    invoice.state = EInvoiceState.REQUESTED
    await runPromise(this.invoiceRepository.saveSingle(invoice))

    const table = this.conn.getMetadata(Time).tableName
    const claim = this.conn.createQueryRunner()

    await claim.connect()
    await claim.startTransaction()

    let resend: Promise<ITimeInsertionResult[]> | undefined

    try {
      await claim.query(`SELECT id FROM "${table}" WHERE id = $1 FOR UPDATE`, [
        tracked.id,
      ])

      resend = runPromise(
        this.timeManager.createOrUpdateMany(
          [{ ...payload, minutesActive: 1 }],
          owner,
        ),
      )

      await this.waitForALockWait()

      await claim.query(
        `UPDATE "${table}" SET "invoiceId" = $1 WHERE id = $2`,
        [invoice.id, tracked.id],
      )
      await claim.commitTransaction()
    } finally {
      if (claim.isTransactionActive) {
        await claim.rollbackTransaction()
      }
      await claim.release()
    }

    const [resent] = (await resend)!

    expect(resent.error?.name).to.equal('InvoicedTimeException')

    const row = await this.conn
      .getRepository(Time)
      .findOneOrFail({ where: { id: tracked.id } })

    expect([row.invoiceId, row.minutesActive]).to.deep.equal([
      invoice.id,
      payload.minutesActive,
    ])
  }

  /** Resolves once some backend of this database is waiting on a lock. */
  private async waitForALockWait(): Promise<void> {
    for (let attempt = 0; attempt < 250; attempt += 1) {
      const [{ waiting }] = await this.conn.query(
        `SELECT count(*)::int AS waiting FROM pg_stat_activity
         WHERE datname = current_database() AND wait_event_type = 'Lock'`,
      )

      if (waiting > 0) {
        return
      }

      await new Promise((resolve) => setTimeout(resolve, 20))
    }

    throw new Error('the re-upload never waited on the locked row')
  }

  @test()
  async setIsPaidMany_allowsAuthorToMarkOwnEntries() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
      owner,
    )

    await runPromise(this.timeManager.setIsPaidMany([time.id], true, owner))

    const updated = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: time.id },
      }),
    )
    expect(updated!.isPaid).to.be.true
  }

  @test()
  async setIsPaidMany_deniesNonAuthorEvenWhenProjectOwner() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
      worker,
    )

    let error: unknown

    try {
      await runPromise(this.timeManager.setIsPaidMany([time.id], true, owner))
    } catch (e: unknown) {
      error = e
    }

    expect(error).to.be.instanceOf(AccessException)
  }

  @test()
  async createOrUpdateMany_freeOwner_purgesOwnProjectEntriesOlderThanWindow() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    const staleEntry = await this.timeFixture.create(
      project,
      moment
        .utc()
        .subtract(TimeManagerTest.staleDays(), 'days')
        .subtract(10, 'minutes')
        .toDate(),
      moment.utc().subtract(TimeManagerTest.staleDays(), 'days').toDate(),
      owner,
    )
    const freshEntry = await this.timeFixture.create(
      project,
      moment.utc().subtract(2, 'days').subtract(10, 'minutes').toDate(),
      moment.utc().subtract(2, 'days').toDate(),
      owner,
    )

    await runPromise(
      this.timeManager.createOrUpdateMany(
        [this.buildTimePayload(project.id, 5)],
        owner,
      ),
    )

    const stale = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: staleEntry.id },
      }),
    )
    const fresh = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: freshEntry.id },
      }),
    )

    expect(stale).to.be.undefined
    expect(fresh).to.exist

    // ...and the purged entry is gone from the real read path too, not just
    // from a direct id lookup.
    const [rows] = await runPromise(
      this.timeRepository.findAndCount(
        { filter: {}, sort: { createdAt: 'ASC' }, page: 0 },
        owner,
      ),
    )
    const visibleIds = rows.map((row) => row.id)
    expect(visibleIds).to.not.include(staleEntry.id)
    expect(visibleIds).to.include(freshEntry.id)
  }

  @test()
  async createOrUpdateMany_premiumOwner_keepsEntriesOlderThanWindow() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    const staleEntry = await this.timeFixture.create(
      project,
      moment.utc().subtract(30, 'days').subtract(10, 'minutes').toDate(),
      moment.utc().subtract(30, 'days').toDate(),
      owner,
    )

    await runPromise(
      this.timeManager.createOrUpdateMany(
        [this.buildTimePayload(project.id, 6)],
        owner,
      ),
    )

    const stale = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: staleEntry.id },
      }),
    )

    expect(stale).to.exist
  }

  /**
   * Retention follows the project owner's plan, not the author's. A free-tier
   * worker syncing time must not purge history on a premium client's project -
   * that history is what the client is paying to keep.
   */
  @test()
  async createOrUpdateMany_freeWorker_doesNotPurgePremiumOwnersProject() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const ownerStaleEntry = await this.timeFixture.create(
      project,
      moment
        .utc()
        .subtract(TimeManagerTest.staleDays(), 'days')
        .subtract(10, 'minutes')
        .toDate(),
      moment.utc().subtract(TimeManagerTest.staleDays(), 'days').toDate(),
      owner,
    )
    const workerStaleEntry = await this.timeFixture.create(
      project,
      moment
        .utc()
        .subtract(TimeManagerTest.staleDays(6), 'days')
        .subtract(10, 'minutes')
        .toDate(),
      moment.utc().subtract(TimeManagerTest.staleDays(6), 'days').toDate(),
      worker,
    )

    const [result] = await runPromise(
      this.timeManager.createOrUpdateMany(
        [this.buildTimePayload(project.id, 7)],
        worker,
      ),
    )

    expect(result.error).to.be.undefined

    const ownerStale = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: ownerStaleEntry.id },
      }),
    )
    const workerStale = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: workerStaleEntry.id },
      }),
    )

    expect(ownerStale).to.exist
    expect(workerStale).to.exist
  }

  /**
   * A premium worker on a free owner's project is still subject to that
   * project's retention - the entitlement belongs to the project, not to
   * whoever happens to be typing.
   */
  @test()
  async createOrUpdateMany_premiumWorker_stillPurgedOnFreeOwnersProject() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const staleEntry = await this.timeFixture.create(
      project,
      moment
        .utc()
        .subtract(TimeManagerTest.staleDays(), 'days')
        .subtract(10, 'minutes')
        .toDate(),
      moment.utc().subtract(TimeManagerTest.staleDays(), 'days').toDate(),
      worker,
    )

    // The owner downgrades after the fact; the project falls under free-tier
    // retention from the next sync onwards.
    owner.premium = false
    await runPromise(this.userManager.saveSingle(owner))

    await runPromise(
      this.timeManager.createOrUpdateMany(
        [this.buildTimePayload(project.id, 8)],
        owner,
      ),
    )

    const stale = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: staleEntry.id },
      }),
    )

    expect(stale).to.be.undefined
  }

  /**
   * An offline tracker syncing a backlog must be told the entry was refused.
   * Storing it and purging it in the same request would hand the client an id
   * for a row that no longer exists, and the client would drop its local copy.
   */
  @test()
  async createOrUpdateMany_freeOwner_rejectsBacklogInsteadOfAcceptingThenPurging() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    const backlog = this.buildTimePayload(project.id, 9)
    backlog.fromAt = moment
      .utc()
      .subtract(TimeManagerTest.staleDays(), 'days')
      .toISOString()
    backlog.toAt = moment
      .utc()
      .subtract(TimeManagerTest.staleDays(), 'days')
      .add(10, 'minutes')
      .toISOString()

    const [result] = await runPromise(
      this.timeManager.createOrUpdateMany([backlog], owner),
    )

    expect(result.id).to.be.undefined
    expect(result.error).to.exist
    expect(result.error?.name).to.be.equal('RetentionExceededException')

    // Nothing was written at all - not written-then-removed.
    const stored = await runPromise(
      this.timeRepository.findBy({
        where: { project: { id: project.id } },
      }),
    )
    expect(stored).to.deep.equal([])
  }

  /**
   * A retention purge must never remove the detail backing an issued invoice.
   */
  @test()
  async createOrUpdateMany_freeOwner_keepsEntriesCoveredByAnInvoice() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    const invoicedFrom = moment
      .utc()
      .subtract(TimeManagerTest.staleDays(10), 'days')
    const invoicedTo = moment
      .utc()
      .subtract(TimeManagerTest.staleDays(5), 'days')

    const invoicedEntry = await this.timeFixture.create(
      project,
      invoicedFrom.clone().add(1, 'day').toDate(),
      invoicedFrom.clone().add(1, 'day').add(10, 'minutes').toDate(),
      owner,
    )
    const uninvoicedEntry = await this.timeFixture.create(
      project,
      moment.utc().subtract(TimeManagerTest.staleDays(), 'days').toDate(),
      moment
        .utc()
        .subtract(TimeManagerTest.staleDays(), 'days')
        .add(10, 'minutes')
        .toDate(),
      owner,
    )

    const invoice = new Invoice()
    invoice.project = project
    invoice.fromAt = invoicedFrom.toDate()
    invoice.toAt = invoicedTo.toDate()
    invoice.amountCents = 10_000
    invoice.state = EInvoiceState.REQUESTED
    await runPromise(this.invoiceRepository.saveSingle(invoice))

    await runPromise(
      this.timeManager.createOrUpdateMany(
        [this.buildTimePayload(project.id, 10)],
        owner,
      ),
    )

    const invoiced = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: invoicedEntry.id },
      }),
    )
    const uninvoiced = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: uninvoicedEntry.id },
      }),
    )

    expect(invoiced).to.exist
    expect(uninvoiced).to.be.undefined
  }

  /**
   * A hand-made paid mark racing an invoice for the same entry. Whichever
   * wins, the records must agree: either the entry is paid and on no
   * invoice, or it is on the (unpaid) invoice and the mark was refused. The
   * mark used to read the entry, then write it, with the invoice free to
   * claim it in between - ending paid under a REQUESTED invoice. Run over
   * several entries so both orders get exercised.
   */
  @test()
  async setIsPaidMany_racingAnInvoice_neverLeavesThemDisagreeing() {
    const invoiceManager: InvoiceManager = this.container.get('InvoiceManager')
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const now = moment.utc()

    for (let round = 1; round <= 6; round += 1) {
      const entry = await this.timeFixture.create(
        project,
        now.clone().subtract(round, 'hours').toDate(),
        now.clone().subtract(round, 'hours').add(30, 'minutes').toDate(),
        owner,
      )

      const [mark] = await new ConcurrentCalls(this.conn).settle<unknown>([
        () =>
          runPromise(this.timeManager.setIsPaidMany([entry.id], true, owner)),
        () => runPromise(invoiceManager.ensureForProject(project, owner)),
      ])

      const stored = await this.conn.getRepository(Time).findOneOrFail({
        where: { id: entry.id },
        relations: { invoice: true },
      })

      if (stored.invoice) {
        expect(stored.invoice.state, `round ${round}`).to.equal(
          EInvoiceState.REQUESTED,
        )
        expect(stored.isPaid, `round ${round}`).to.be.false
        expect(mark.status, `round ${round}`).to.equal('rejected')
      } else {
        expect(stored.isPaid, `round ${round}`).to.be.true
      }
    }
  }
}
