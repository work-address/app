import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import { randomUUID } from 'crypto'
import { Effect } from 'effect'
import moment from 'moment'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { Project } from '@/entity/project'
import { Time } from '@/entity/time'
import { User } from '@/entity/user'
import { WorkerSeat } from '@/entity/worker-seat'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { TimeFixture } from '@/test/fixture/time-fixture'
import { UserFixture } from '@/test/fixture/user-fixture'
import { IConfigParameters } from '@/model/config'
import { EProjectState } from '@/model/project'
import { WorkerSeats } from '@/service/worker-seats'
import { PlanChange } from '@/service/plan-change'
import { AgentRunRecord } from '@/service/agent-run-record'
import { TimeManager } from '@/service/time-manager'
import { AgentRepository } from '@/repository/agent-repository'
import { TimeAgent } from '@/entity/time-agent'
import { TimeCreateDto } from '@/model/dto/time'
import { FREE_RETENTION_DAYS } from '@/model/plan'
import { Plan } from '@/service/plan'
import { ProjectManager } from '@/service/project-manager'
import { runPromise } from '@/service/effect-bridge'
import { UserManager } from '@/service/user-manager'

const at = (hour: number) => new Date(Date.UTC(2026, 10, 1, hour))

type PlanKind = 'Premium' | 'no plan' | 'self-hosted'

const UNUSED = '0x52908400098527886E0F7030069857D2E4169EE7'

/**
 * Everything an owner's plan limits, at the Plan module's interface and through
 * the uploads that apply it: PRODUCT.md §5.
 */
@suite()
export class PlanTest extends AbstractDatabaseIntegration {
  private plan: Plan
  private manager: ProjectManager
  private fixture: ProjectFixture
  private users: UserFixture
  private userManager: UserManager
  private config: IConfigParameters
  private savedSecret: string
  private previousFlag: string | undefined

  constructor() {
    super()
    this.plan = this.container.get('Plan')
    this.manager = this.container.get('ProjectManager')
    this.fixture = this.container.get('ProjectFixture')
    this.users = this.container.get('UserFixture')
    this.userManager = this.container.get('UserManager')
    this.config = this.container.get('parameters')
    this.savedSecret = this.config.entitlementSecret
    this.config.entitlementSecret = 'secret'
  }

  async before() {
    this.previousFlag = process.env.AGENT_TRACKING_ENABLED
    delete process.env.AGENT_TRACKING_ENABLED
    await super.before()
  }

  async after() {
    if (this.previousFlag === undefined)
      delete process.env.AGENT_TRACKING_ENABLED
    else process.env.AGENT_TRACKING_ENABLED = this.previousFlag
    this.config.entitlementSecret = this.savedSecret
    await super.after()
  }

  private async owner(premium: boolean): Promise<User> {
    const owner = await this.users.createUser()
    owner.premium = premium
    return runPromise(this.userManager.saveSingle(owner))
  }

  private async project(owner: User, workers: string[]): Promise<Project> {
    const project = await this.fixture.createPersonal(owner)
    project.user = owner
    project.workerAddresses = workers
    return this.conn.getRepository(Project).save(project)
  }

  private edit(project: Project, workerAddresses: string[]) {
    return runPromise(
      this.manager.editAndSave(project, {
        workerAddresses,
        viewerAddresses: project.viewerAddresses ?? [],
      } as unknown as Project),
    )
  }

  @test()
  thePeakIsTheMostOpenAtOnce() {
    const period = { from: at(1), to: at(10) }

    const peak = (intervals: { startedAt: Date; endedAt: Date | null }[]) =>
      WorkerSeats.peak(intervals, period.from, period.to)

    expect(peak([])).to.equal(0)
    expect(
      peak([
        { startedAt: at(2), endedAt: at(4) },
        { startedAt: at(3), endedAt: null },
      ]),
      'overlapping',
    ).to.equal(2)
    expect(
      peak([
        { startedAt: at(2), endedAt: at(4) },
        { startedAt: at(4), endedAt: null },
      ]),
      'replacing a worker is one seat',
    ).to.equal(1)
    expect(
      peak([
        { startedAt: at(0), endedAt: at(1) },
        { startedAt: at(10), endedAt: null },
      ]),
      'outside the period',
    ).to.equal(0)
    expect(
      peak([{ startedAt: at(0), endedAt: null }]),
      'open since before the period',
    ).to.equal(1)
  }

  @test()
  async aSeatIsAListedWorkerWhoHasSignedInCountedOnce() {
    const owner = await this.owner(true)
    const worker = await this.users.createUser()
    await this.project(owner, [worker.address, UNUSED])
    await this.project(owner, [worker.address.toUpperCase()])

    const inventory = await this.plan.inventory(owner)

    expect(inventory.connected).to.equal(1)
    expect(inventory.seats).to.equal(1)
    expect(inventory.workers.map((w) => w.address)).to.deep.equal([
      worker.address,
    ])
  }

  @test()
  async anOwnerAloneIsBilledTheOneSeatMinimum() {
    const inventory = await this.plan.inventory(await this.owner(true))

    expect(inventory.connected).to.equal(0)
    expect(inventory.seats).to.equal(1)
  }

  @test()
  async closedProjectsDoNotCountTowardsTheBill() {
    const owner = await this.owner(true)
    const worker = await this.users.createUser()
    const project = await this.project(owner, [worker.address])

    project.state = EProjectState.INACTIVE
    await this.conn.getRepository(Project).save(project)

    expect((await this.plan.inventory(owner)).connected).to.equal(0)
  }

  @test()
  async aWorkerRemovedDuringThePeriodIsStillCharged() {
    const owner = await this.owner(true)
    const first = await this.users.createUser()
    const second = await this.users.createUser()
    const project = await this.project(owner, [first.address, second.address])
    const from = moment.utc().subtract(1, 'day').toDate()

    await this.edit(project, [first.address])

    const during = await this.plan.inventory(owner, {
      from,
      to: moment.utc().add(1, 'day').toDate(),
    })

    expect(during.connected).to.equal(1)
    expect(during.seats, 'the highest count').to.equal(2)

    const next = await this.plan.inventory(owner, {
      from: moment.utc().add(1, 'day').toDate(),
      to: moment.utc().add(2, 'days').toDate(),
    })

    expect(next.seats, 'the period after').to.equal(1)
  }

  @test()
  async openSeatsStayUniqueAcrossRepeatedSyncs() {
    const owner = await this.owner(true)
    const worker = await this.users.createUser()
    await this.project(owner, [worker.address])

    await runPromise(this.plan.aroundListChange(owner.id, Effect.void))
    await runPromise(this.plan.aroundListChange(owner.id, Effect.void))

    expect(
      await this.conn.getRepository(WorkerSeat).count({
        where: { ownerId: owner.id },
      }),
    ).to.equal(1)
  }

  @test()
  async theFreePlanIncludesTwoWorkersAcrossProjects() {
    const owner = await this.owner(false)
    const project = await this.project(owner, [])
    const other = await this.project(owner, [])
    const [one, two, three] = [
      '0x0000000000000000000000000000000000000001',
      '0x0000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000003',
    ]

    await this.edit(project, [one])
    await this.edit(other, [two, one])

    let refused = false
    await this.edit(project, [one, three]).catch(() => {
      refused = true
    })
    expect(refused, 'a third worker').to.be.true

    // Already on another project, so no new person.
    await this.edit(project, [one, two])
    // Swapping one out is fine.
    await this.edit(other, [])
    await this.edit(project, [one, three])
  }

  @test()
  async viewersAreFreeWhateverThePlan() {
    const owner = await this.owner(false)
    const project = await this.project(owner, [])

    await runPromise(
      this.manager.editAndSave(project, {
        workerAddresses: [],
        viewerAddresses: [
          '0x0000000000000000000000000000000000000001',
          '0x0000000000000000000000000000000000000002',
          '0x0000000000000000000000000000000000000003',
        ],
      } as unknown as Project),
    )

    expect(project.viewerAddresses).to.have.length(3)
  }

  @test()
  async aLapsedOwnerCanStillRemoveWorkers() {
    const owner = await this.owner(false)
    const addresses = [
      '0x0000000000000000000000000000000000000001',
      '0x0000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000003',
    ]
    const project = await this.project(owner, addresses)

    await this.edit(project, addresses.slice(0, 2))

    expect(project.workerAddresses).to.have.length(2)
  }

  @test()
  async withNoPlanTheFirstListedKeepTrackingUntilTheOwnerChooses() {
    const owner = await this.owner(false)
    const workers = [
      await this.users.createUser(),
      await this.users.createUser(),
      await this.users.createUser(),
    ]
    const project = await this.project(
      owner,
      workers.map((w) => w.address),
    )

    expect(await this.plan.mayTrack(project, owner), 'owner').to.be.true
    expect(await this.plan.mayTrack(project, workers[0])).to.be.true
    expect(await this.plan.mayTrack(project, workers[1])).to.be.true
    expect(await this.plan.mayTrack(project, workers[2])).to.be.false

    owner.keptWorkers = [workers[2].address]
    await runPromise(this.userManager.saveSingle(owner))

    expect(await this.plan.mayTrack(project, workers[0]), 'topped up').to.be
      .true
    expect(await this.plan.mayTrack(project, workers[1])).to.be.false
    expect(await this.plan.mayTrack(project, workers[2]), 'chosen').to.be.true
  }

  // The matrix: plan by person by record. Each cell goes through the upload a
  // tracker or a collector makes, so it holds the wiring as well as the rule.

  /** An owner on `kind` with three workers; without a plan the third is not kept. */
  private async world(kind: PlanKind) {
    this.config.entitlementSecret = kind === 'self-hosted' ? '' : 'secret'
    const owner = await this.owner(kind === 'Premium')
    const kept = await this.users.createUser()
    const second = await this.users.createUser()
    const unkept = await this.users.createUser()
    // A worker's own plan changes nothing on someone else's project.
    kept.premium = true
    await runPromise(this.userManager.saveSingle(kept))
    const project = await this.project(owner, [
      kept.address,
      second.address,
      unkept.address,
    ])
    project.trackAgents = true
    await this.conn.getRepository(Project).save(project)

    return {
      owner,
      project,
      people: { owner, 'kept worker': kept, 'unkept worker': unkept },
    }
  }

  private entry(projectId: string, daysAgo = 0): TimeCreateDto {
    const toAt = moment.utc().subtract(daysAgo, 'days')

    return {
      fromIndex: 1,
      toIndex: 2,
      note: 'entry',
      keyboardKeys: 1,
      minutesActive: 10,
      mouseKeys: 1,
      mouseDistance: 1,
      fromAt: toAt.clone().subtract(10, 'minutes').toISOString(),
      toAt: toAt.toISOString(),
      projectId,
    }
  }

  /** Whether the person's upload of an entry was stored. */
  private async uploadsEntry(
    person: User,
    projectId: string,
    daysAgo = 0,
  ): Promise<boolean> {
    const [result] = await runPromise(
      this.container
        .get<TimeManager>('TimeManager')
        .createOrUpdateMany([this.entry(projectId, daysAgo)], person),
    )

    return !result.error
  }

  /** A collector of the person's, uploading runs of their agent on the project. */
  private async collector(person: User, project: Project) {
    const agents = this.container.get<AgentRepository>('AgentRepository')
    const record = this.container.get<AgentRunRecord>('AgentRunRecord')
    const agent = await agents.save(
      person,
      {
        name: 'Mine',
        slug: 'mine',
        product: 'codex',
        isDefault: true,
        bindings: [],
      },
      true,
    )
    await agents.attach(person, project.id, agent.id!, 600)
    const instanceId = randomUUID()
    const { credential } = await agents.issue(person, {
      instanceId,
      mode: 'timer',
    })
    const epoch = randomUUID()
    let sequence = 0

    /** Whether the run's start was stored. */
    return async (runId: string): Promise<boolean> => {
      const at = new Date(Date.now() - 300000).toISOString()
      const { results } = await record.ingest(`Bearer ${credential}`, {
        events: [
          {
            schemaVersion: 1,
            eventId: randomUUID(),
            source: {
              product: 'codex',
              surface: 'cli',
              instanceId,
              adapterVersion: '0.1.0',
              runtimeVersion: 'synthetic-test',
              epoch,
              sequence: sequence++,
            },
            projectId: project.id,
            sessionId: 'session',
            runId,
            agentId: 'root',
            occurredAt: at,
            observedAt: at,
            clock: { basis: 'source_wall' },
            capabilities: {
              runBoundaries: true,
              externalWaits: 'complete',
              replay: true,
            },
            eventType: 'run.started',
          },
        ],
      })

      return (results as { status: string }[])[0].status === 'accepted'
    }
  }

  private async seesEntry(id: string): Promise<boolean> {
    return (await this.conn.getRepository(Time).findOneBy({ id })) !== null
  }

  private async seesRun(sourceRunId: string): Promise<boolean> {
    return (
      (await this.conn.getRepository(TimeAgent).findOneBy({ sourceRunId })) !==
      null
    )
  }

  private async whoMayRecord(kind: PlanKind) {
    const { project, people } = await this.world(kind)
    const everyone = kind !== 'no plan'

    for (const [who, may] of [
      ['owner', true],
      ['kept worker', true],
      ['unkept worker', everyone],
    ] as const) {
      const person = people[who]
      const label = `${kind}, ${who}`

      expect(await this.plan.mayTrack(project, person), label).to.equal(may)
      expect(
        await this.uploadsEntry(person, project.id),
        `${label}: entry`,
      ).to.equal(may)
      expect(
        await (
          await this.collector(person, project)
        )(randomUUID()),
        `${label}: run`,
      ).to.equal(may)
    }
  }

  @test() async withPremiumEveryoneListedRecords() {
    await this.whoMayRecord('Premium')
  }

  @test() async withNoPlanOnlyTheOwnerAndTheKeptRecord() {
    await this.whoMayRecord('no plan')
  }

  @test() async selfHostedEveryoneListedRecords() {
    await this.whoMayRecord('self-hosted')
  }

  /**
   * An entry and a run from before the window, then a new upload of each: the
   * arrival is what rotates. Returns what is still there afterwards.
   */
  private async afterTheWindow(kind: PlanKind) {
    const { owner, project, people } = await this.world(kind)
    const worker = people['kept worker']
    const old = moment.utc().subtract(FREE_RETENTION_DAYS + 1, 'days')
    const times = this.container.get<TimeFixture>('TimeFixture')
    const entry = await times.create(
      project,
      old.clone().subtract(10, 'minutes').toDate(),
      old.toDate(),
      worker,
    )
    const startsRun = await this.collector(worker, project)
    await startsRun('old')
    await this.conn
      .getRepository(TimeAgent)
      .update({ sourceRunId: 'old' }, { fromAt: old.toDate() })

    const backlogStored = await this.uploadsEntry(
      owner,
      project.id,
      FREE_RETENTION_DAYS + 2,
    )
    await this.uploadsEntry(owner, project.id)
    await startsRun('new')

    return {
      owner,
      entry: await this.seesEntry(entry.id),
      run: await this.seesRun('old'),
      backlogStored,
      again: async () => ({
        entry: await this.seesEntry(entry.id),
        run: await this.seesRun('old'),
      }),
    }
  }

  @test() async withPremiumNothingIsRotated() {
    const kept = await this.afterTheWindow('Premium')

    expect(kept).to.include({ entry: true, run: true, backlogStored: true })
  }

  @test() async selfHostedNothingIsRotated() {
    const kept = await this.afterTheWindow('self-hosted')

    expect(kept).to.include({ entry: true, run: true, backlogStored: true })
  }

  /** The plan is the owner's: the worker here has Premium of their own. */
  @test() async withNoPlanWhatIsPastTheWindowIsHiddenUntilAnUpgrade() {
    const hidden = await this.afterTheWindow('no plan')

    expect(hidden).to.include({
      entry: false,
      run: false,
      backlogStored: false,
    })

    await runPromise(
      this.container.get<PlanChange>('PlanChange').apply(hidden.owner, true),
    )

    expect(await hidden.again()).to.deep.equal({ entry: true, run: true })
  }

  /** The longest a hosted instance keeps any screenshot, whatever the project says. */
  private async oldScreenshotAfterAnUpload(kind: PlanKind) {
    const { owner, project } = await this.world(kind)
    const times = this.container.get<TimeFixture>('TimeFixture')
    const old = moment.utc().subtract(400, 'days')
    const time = await times.create(
      project,
      old.clone().subtract(10, 'minutes').toDate(),
      old.toDate(),
      owner,
    )
    await this.conn
      .getRepository(Time)
      .update(time.id, { screenshot: 'picture' })

    await this.uploadsEntry(owner, project.id)

    return (await this.conn.getRepository(Time).findOneBy({ id: time.id }))
      ?.screenshot
  }

  @test() async aHostedScreenshotIsKeptForAYearAtMost() {
    expect(await this.oldScreenshotAfterAnUpload('Premium')).to.be.null
  }

  @test() async aSelfHostedScreenshotHasNoLimit() {
    expect(await this.oldScreenshotAfterAnUpload('self-hosted')).to.equal(
      'picture',
    )
  }
}
