import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
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
import { ProjectManager } from '@/service/project-manager'
import { TimeRepository } from '@/repository/time-repository'
import { runPromise } from '@/service/effect-bridge'
import { UserManager } from '@/service/user-manager'

const at = (hour: number) => new Date(Date.UTC(2026, 10, 1, hour))

const UNUSED = '0x52908400098527886E0F7030069857D2E4169EE7'

/** Who is on the bill, who may be added, and who may track: PRODUCT.md §5. */
@suite()
export class WorkerSeatsTest extends AbstractDatabaseIntegration {
  private seats: WorkerSeats
  private manager: ProjectManager
  private fixture: ProjectFixture
  private users: UserFixture
  private userManager: UserManager
  private config: IConfigParameters
  private savedSecret: string

  constructor() {
    super()
    this.seats = this.container.get('WorkerSeats')
    this.manager = this.container.get('ProjectManager')
    this.fixture = this.container.get('ProjectFixture')
    this.users = this.container.get('UserFixture')
    this.userManager = this.container.get('UserManager')
    this.config = this.container.get('parameters')
    this.savedSecret = this.config.entitlementSecret
    this.config.entitlementSecret = 'secret'
  }

  async after() {
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

    const inventory = await this.seats.inventory(owner)

    expect(inventory.connected).to.equal(1)
    expect(inventory.seats).to.equal(1)
    expect(inventory.workers.map((w) => w.address)).to.deep.equal([
      worker.address,
    ])
  }

  @test()
  async anOwnerAloneIsBilledTheOneSeatMinimum() {
    const inventory = await this.seats.inventory(await this.owner(true))

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

    expect((await this.seats.inventory(owner)).connected).to.equal(0)
  }

  @test()
  async aWorkerRemovedDuringThePeriodIsStillCharged() {
    const owner = await this.owner(true)
    const first = await this.users.createUser()
    const second = await this.users.createUser()
    const project = await this.project(owner, [first.address, second.address])
    const from = moment.utc().subtract(1, 'day').toDate()

    await this.edit(project, [first.address])

    const during = await this.seats.inventory(owner, {
      from,
      to: moment.utc().add(1, 'day').toDate(),
    })

    expect(during.connected).to.equal(1)
    expect(during.seats, 'the highest count').to.equal(2)

    const next = await this.seats.inventory(owner, {
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

    await this.seats.sync(owner.id)
    await this.seats.sync(owner.id)

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

    expect(await this.seats.mayTrack(project, owner), 'owner').to.be.true
    expect(await this.seats.mayTrack(project, workers[0])).to.be.true
    expect(await this.seats.mayTrack(project, workers[1])).to.be.true
    expect(await this.seats.mayTrack(project, workers[2])).to.be.false

    owner.keptWorkers = [workers[2].address]
    await runPromise(this.userManager.saveSingle(owner))

    expect(await this.seats.mayTrack(project, workers[0]), 'topped up').to.be
      .true
    expect(await this.seats.mayTrack(project, workers[1])).to.be.false
    expect(await this.seats.mayTrack(project, workers[2]), 'chosen').to.be.true
  }

  @test()
  async withAPlanEveryWorkerTracks() {
    const owner = await this.owner(true)
    const workers = [
      await this.users.createUser(),
      await this.users.createUser(),
      await this.users.createUser(),
    ]
    const project = await this.project(
      owner,
      workers.map((w) => w.address),
    )

    expect(await this.seats.mayTrack(project, workers[2])).to.be.true
  }

  @test()
  async selfHostedHasNoLimit() {
    this.config.entitlementSecret = ''
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

    expect(await this.seats.mayTrack(project, workers[2])).to.be.true
  }

  @test()
  async upgradingBringsBackWhatRotationHid() {
    const owner = await this.owner(false)
    const project = await this.project(owner, [])
    const times = this.container.get<TimeFixture>('TimeFixture')
    const old = moment.utc().subtract(30, 'days')
    const time = await times.create(
      project,
      old.toDate(),
      old.clone().add(10, 'minutes').toDate(),
      owner,
    )
    const repository = this.container.get<TimeRepository>('TimeRepository')

    await runPromise(
      repository.softDeleteExpiredEntriesForProjects([project.id], new Date()),
    )
    expect(await this.conn.getRepository(Time).findOneBy({ id: time.id })).to.be
      .null

    await runPromise(repository.restoreRotated(owner.id))

    expect(await this.conn.getRepository(Time).findOneBy({ id: time.id })).to
      .not.be.null
  }

  @test()
  async aScreenshotIsKeptForAYearAtMost() {
    const owner = await this.owner(true)
    const project = await this.project(owner, [])
    const times = this.container.get<TimeFixture>('TimeFixture')
    const old = moment.utc().subtract(400, 'days')
    const time = await times.create(
      project,
      old.toDate(),
      old.clone().add(10, 'minutes').toDate(),
      owner,
    )
    await this.conn
      .getRepository(Time)
      .update(time.id, { screenshot: 'picture' })
    const repository = this.container.get<TimeRepository>('TimeRepository')

    await runPromise(repository.purgeExpiredScreenshots([project.id]))
    expect(
      (await this.conn.getRepository(Time).findOneBy({ id: time.id }))
        ?.screenshot,
      'no limit',
    ).to.equal('picture')

    await runPromise(repository.purgeExpiredScreenshots([project.id], 365))
    expect(
      (await this.conn.getRepository(Time).findOneBy({ id: time.id }))
        ?.screenshot,
      'hosted limit',
    ).to.be.null
  }
}
