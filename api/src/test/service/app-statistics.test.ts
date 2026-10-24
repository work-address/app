import { expect } from 'chai'
import { Effect } from 'effect'
import { suite, test } from '@testdeck/mocha'
import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { TimeManager } from '@/service/time-manager'
import { StatisticsManager } from '@/service/statistics-manager'
import { TimeRepository } from '@/repository/time-repository'
import { AppUsage } from '@/entity/app-usage'
import { Project } from '@/entity/project'
import { Time } from '@/entity/time'
import { AppUsagePolicy } from '@/service/app-usage-policy'
import { EProjectState } from '@/model/project'
import { TimeCreateDto } from '@/model/dto/time'
import { runPromise } from '@/service/effect-bridge'

@suite()
export class AppStatisticsTest extends AbstractDatabaseIntegration {
  private payload(projectId: string): TimeCreateDto {
    const end = Date.now() - 60000
    return {
      projectId,
      fromAt: new Date(end - 600000).toISOString(),
      toAt: new Date(end).toISOString(),
      fromIndex: 0,
      toIndex: 1,
      note: '',
      minutesActive: 7,
      keyboardKeys: 1,
      mouseKeys: 0,
      mouseDistance: 0,
      appsStatus: 'ok',
      apps: [
        {
          name: 'Code',
          seconds: 420,
          titles: [{ title: 'Example', domain: 'example.com', seconds: 420 }],
        },
      ],
    }
  }
  @test() async savesBreakdownAtomicallyAndDeduplicatesRetries() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.container
      .get<ProjectFixture>('ProjectFixture')
      .create(owner, EProjectState.ACTIVE)
    project.trackProcesses = true
    await this.conn.manager.save(project)
    const manager = this.container.get<TimeManager>('TimeManager')
    const input = this.payload(project.id)
    const [first] = await runPromise(manager.createOrUpdateMany([input], owner))
    expect(first.error).to.equal(undefined)
    expect(first.appsAccepted).to.equal(true)
    const [second] = await runPromise(
      manager.createOrUpdateMany([input], owner),
    )
    expect(second.id).to.equal(first.id)
    const rows = await this.conn.getRepository(AppUsage).find()
    expect(rows).to.have.length(1)
    expect(rows[0].seconds).to.equal(420)
    expect(rows[0].title).to.equal(null)
    expect(rows[0].domain).to.equal(null)
  }
  @test() async publicationPreservesAnUploadCommittedAfterItsOwnershipCheck() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.container
      .get<ProjectFixture>('ProjectFixture')
      .createPersonal(owner)
    project.trackProcesses = true
    await this.conn.manager.save(project)
    const manager = this.container.get<TimeManager>('TimeManager')
    const repo = this.container.get<TimeRepository>('TimeRepository')
    Object.assign(manager, { timeRepository: repo })
    const input = {
      ...this.payload(project.id),
      minutesActive: 1,
      apps: [{ name: 'Code', seconds: 60 }],
    }
    const [first] = await runPromise(manager.createOrUpdateMany([input], owner))
    expect(first.error).to.equal(undefined)
    const updated = {
      ...input,
      minutesActive: 5,
      note: 'Updated upload',
      toAt: new Date(Date.parse(input.toAt) + 60000).toISOString(),
      apps: [{ name: 'Code', seconds: 300 }],
    }
    const original = repo.findByIdsAsAuthor.bind(repo)
    let interleaved = false
    repo.findByIdsAsAuthor = (ids, user) =>
      original(ids, user).pipe(
        Effect.flatMap((times) =>
          Effect.promise(async () => {
            const [result] = await runPromise(
              manager.createOrUpdateMany([updated], owner),
            )
            expect(result.error).to.equal(undefined)
            interleaved = true
            return times
          }),
        ),
      )
    try {
      await runPromise(manager.publish([first.id!], owner))
    } finally {
      repo.findByIdsAsAuthor = original
    }
    expect(interleaved).to.equal(true)
    const saved = await this.conn.manager.findOneByOrFail(Time, {
      id: first.id,
    })
    expect(saved).to.include({ minutesActive: 5, note: updated.note })
    expect(saved.toAt.toISOString()).to.equal(updated.toAt)
    expect(saved.publishedAt).to.be.instanceOf(Date)
    expect(
      (await this.conn.manager.find(AppUsage)).map((row) => row.seconds),
    ).to.deep.equal([300])
    await runPromise(manager.publish([first.id!, first.id!], owner))
    const repeated = await this.conn.manager.findOneByOrFail(Time, {
      id: first.id,
    })
    expect(repeated.publishedAt).to.deep.equal(saved.publishedAt)
  }
  @test() async separatesWorkersAndHidesDetailUntilReview() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const colleague = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.container
      .get<ProjectFixture>('ProjectFixture')
      .create(owner, EProjectState.ACTIVE)
    Object.assign(project, {
      workerAddresses: [worker.address, colleague.address],
      viewerAddresses: [viewer.address],
      trackProcesses: true,
    })
    await this.conn.manager.save(project)
    const manager = this.container.get<TimeManager>('TimeManager')
    const input = this.payload(project.id)
    const [a] = await runPromise(manager.createOrUpdateMany([input], worker))
    const [b] = await runPromise(manager.createOrUpdateMany([input], colleague))
    expect(a.error).to.equal(undefined)
    expect(b.error).to.equal(undefined)
    expect(a.id).not.to.equal(b.id)
    const repo = this.container.get<TimeRepository>('TimeRepository')
    const time = Object.assign(new Time(), { id: a.id })
    expect(
      (await runPromise(repo.findOneConfirmUser(time, worker))).apps,
    ).to.have.length(1)
    expect(
      (await runPromise(repo.findOneConfirmUser(time, owner))).apps,
    ).to.equal(undefined)
    const [hidden] = await runPromise(
      repo.findAndCount(
        {
          filter: { projectId: project.id, minutesActiveFrom: 1 },
          sort: { createdAt: 'ASC' },
          page: 0,
        },
        owner,
      ),
    )
    expect(hidden).to.have.length(0)
    await this.conn
      .getRepository(Time)
      .update(a.id!, { publishedAt: new Date() })
    expect(
      (await runPromise(repo.findOneConfirmUser(time, owner))).apps,
    ).to.have.length(1)
    expect(
      (await runPromise(repo.findOneConfirmUser(time, colleague))).apps,
    ).to.equal(undefined)
    expect(
      (await runPromise(repo.findOneConfirmUser(time, viewer))).apps,
    ).to.equal(undefined)
    const query = {
      projectIds: [project.id],
      from: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      to: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      timeZone: 'UTC',
    }
    const statistics =
      this.container.get<StatisticsManager>('StatisticsManager')
    const report = (await statistics.read('summary', query, owner)) as any
    expect(report.apps).to.have.length(1)
    expect(Number(report.apps[0].seconds)).to.equal(420)
    expect(Number(report.totals[0].trackedSeconds)).to.equal(1200)
    let denied = false
    try {
      await statistics.read('titles', query, viewer)
    } catch {
      denied = true
    }
    expect(denied).to.equal(true)
  }
  @test() async omittedProjectsMeanEveryVisibleProject() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const other = await this.userFixture.createPremiumUser()
    const viewer = await this.userFixture.createUser()
    const projects = this.container.get<ProjectFixture>('ProjectFixture')
    const own = await projects.create(owner, EProjectState.ACTIVE)
    Object.assign(own, {
      workerAddresses: [worker.address],
      viewerAddresses: [viewer.address],
    })
    await this.conn.manager.save(own)
    // The owner also works on someone else's project.
    const theirs = await projects.create(other, EProjectState.ACTIVE)
    theirs.workerAddresses = [owner.address]
    await this.conn.manager.save(theirs)
    const manager = this.container.get<TimeManager>('TimeManager')
    const [paid] = await runPromise(
      manager.createOrUpdateMany([this.payload(own.id)], worker),
    )
    await runPromise(
      manager.createOrUpdateMany([this.payload(theirs.id)], owner),
    )
    await this.conn.getRepository(Time).update(paid.id!, { isPaid: true })
    const statistics =
      this.container.get<StatisticsManager>('StatisticsManager')
    const range = {
      from: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      to: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      timeZone: 'UTC',
    }
    const ids = (report: any) =>
      report.totals.map((row: any) => row.projectId).sort()

    const all = (await statistics.read('overview', range, owner)) as any
    expect(ids(all)).to.deep.equal([own.id, theirs.id].sort())
    const ownRow = all.totals.find((row: any) => row.projectId === own.id)
    expect(Number(ownRow.paidSeconds)).to.equal(600)

    // Filtering by a worker narrows "all" to the projects the owner owns,
    // rather than refusing because of the one they only work on.
    const people = (await statistics.read(
      'overview',
      { ...range, userIds: [worker.id] },
      owner,
    )) as any
    expect(ids(people)).to.deep.equal([own.id])

    const viewed = (await statistics.read('overview', range, viewer)) as any
    expect(ids(viewed)).to.deep.equal([own.id])
    expect(viewed.totals[0].paidSeconds).to.equal(undefined)

    const nobody = await this.userFixture.createUser()
    expect(await statistics.read('overview', range, nobody)).to.deep.equal({
      totals: [],
      apps: [],
      gaps: [],
    })
    expect(await statistics.read('projects', range, nobody)).to.deep.equal({
      rows: [],
    })
  }
  @test()
  async rejectsInvalidUsageWithoutLosingTimeAndNeverEchoesAcknowledgement() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.container
      .get<ProjectFixture>('ProjectFixture')
      .create(owner, EProjectState.ACTIVE)
    project.trackProcesses = true
    await this.conn.manager.save(project)
    const input = this.payload(project.id)
    input.apps = [{ name: 'Code', seconds: 99999 }]
    const manager = this.container.get<TimeManager>('TimeManager')
    const [result] = await runPromise(
      manager.createOrUpdateMany([input], owner),
    )
    expect(result.appsAccepted).to.equal(true)
    expect(
      (await this.conn.getRepository(Time).findOneByOrFail({ id: result.id }))
        .appsStatus,
    ).to.equal('invalid')
    expect(await this.conn.getRepository(AppUsage).count()).to.equal(0)
    const [failure] = await runPromise(
      manager.createOrUpdateMany(
        [
          {
            ...input,
            projectId: '00000000-0000-4000-8000-000000000000',
            appsAccepted: true,
          } as any,
        ],
        owner,
      ),
    )
    expect(failure.error).not.to.equal(undefined)
    expect(failure.appsAccepted).to.equal(undefined)
  }
  @test() async publishedUsageStaysFrozenAndExpiredScreenshotsArePurged() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.container
      .get<ProjectFixture>('ProjectFixture')
      .create(owner, EProjectState.ACTIVE)
    Object.assign(project, { trackProcesses: true, screenshotRetentionDays: 1 })
    await this.conn.manager.save(project)
    const manager = this.container.get<TimeManager>('TimeManager')
    const repo = this.container.get<TimeRepository>('TimeRepository')
    const input = this.payload(project.id)
    const [saved] = await runPromise(manager.createOrUpdateMany([input], owner))
    await runPromise(manager.publish([saved.id!], owner))
    input.apps = [{ name: 'Changed after publication', seconds: 420 }]
    const [retried] = await runPromise(
      manager.createOrUpdateMany([input], owner),
    )
    expect(retried.appsAccepted).to.equal(true)
    const rows = await this.conn.getRepository(AppUsage).find()
    expect(rows.map((r) => r.app)).to.deep.equal(['Code'])
    await this.conn.getRepository(Time).update(saved.id!, {
      toAt: new Date(Date.now() - 2 * 86400000),
      screenshot: 'old-image',
    })
    await runPromise(repo.purgeExpiredScreenshots([project.id]))
    expect(
      (await this.conn.getRepository(Time).findOneByOrFail({ id: saved.id }))
        .screenshot,
    ).to.equal(null)
    expect(await this.conn.getRepository(AppUsage).count()).to.equal(1)
  }

  @test() normalizesPrivateLocalAndDisabledDetailsAndPartialMinutes() {
    const project = Object.assign(new Project(), {
      trackProcesses: true,
      trackBrowserDomains: true,
      trackWindowTitles: true,
    })
    const input = this.payload('unused')
    input.apps = [
      {
        name: 'Chrome',
        seconds: 420,
        titles: [
          { title: 'Private browsing', domain: 'secret.test', seconds: 120 },
          { title: 'Local', domain: '127.0.0.1', seconds: 300 },
        ],
      },
    ]
    const rows = AppUsagePolicy.normalize(input, project).rows
    expect(rows[0].domain).to.equal(null)
    expect(rows[1].domain).to.equal('local')
    input.toAt = new Date(Date.parse(input.fromAt) + 10000).toISOString()
    expect(AppUsagePolicy.normalize(input, project).status).to.equal('invalid')
    project.trackProcesses = false
    expect(AppUsagePolicy.normalize(input, project)).to.deep.equal({
      status: 'off',
      reason: null,
      truncated: false,
      rows: [],
    })
  }

  @test() async accountingCanChangeOnlyBeforePublication() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.container
      .get<ProjectFixture>('ProjectFixture')
      .create(owner, EProjectState.ACTIVE)
    project.trackProcesses = true
    await this.conn.manager.save(project)
    const manager = this.container.get<TimeManager>('TimeManager')
    const input = this.payload(project.id)
    const [first] = await runPromise(manager.createOrUpdateMany([input], owner))
    const shorter = {
      ...input,
      toAt: new Date(Date.parse(input.fromAt) + 60000).toISOString(),
      minutesActive: 1,
      apps: [{ name: 'Code', seconds: 60 }],
    }
    const [updated] = await runPromise(
      manager.createOrUpdateMany([shorter], owner),
    )
    expect(updated.error).to.equal(undefined)
    expect(updated.id).to.equal(first.id)
    await runPromise(manager.publish([first.id!], owner))
    for (const changed of [
      input,
      { ...shorter, minutesActive: 0 },
      {
        ...shorter,
        toAt: new Date(Date.parse(shorter.toAt) + 1000).toISOString(),
      },
    ]) {
      const [result] = await runPromise(
        manager.createOrUpdateMany([changed], owner),
      )
      expect(result.error?.name).to.equal('BadRequestError')
      expect(result.appsAccepted).to.equal(undefined)
    }
    const [retry] = await runPromise(
      manager.createOrUpdateMany([shorter], owner),
    )
    expect(retry.error).to.equal(undefined)
    expect(retry.appsAccepted).to.equal(true)
    const saved = await this.conn
      .getRepository(Time)
      .findOneByOrFail({ id: first.id })
    expect(+saved.toAt - +saved.fromAt).to.equal(60000)
    expect(saved.minutesActive).to.equal(1)
    expect(
      (await this.conn.getRepository(AppUsage).find())[0].seconds,
    ).to.equal(60)
  }
}
