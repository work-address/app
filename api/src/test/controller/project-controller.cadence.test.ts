import { expect } from 'chai'
import moment from 'moment-timezone'
import { suite, test } from '@testdeck/mocha'

import {
  projectControllerReadCadence,
  projectControllerSetCadence,
  projectControllerSetCadenceConsent,
} from '@app/api-client'

import { Project } from '@/entity/project'
import { ProjectManager } from '@/service/project-manager'
import { ProjectRepository } from '@/repository/project-repository'
import { EProjectState } from '@/model/project'
import { InvoiceCadence } from '@/service/invoice-cadence'
import { User } from '@/entity/user'
import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { runPromise } from '@/service/effect-bridge'

/** Mondays at 09:00 New York time, the cadence every case below sets. */
const MONDAY_NY = {
  weekday: 1,
  timezone: 'America/New_York',
  cutoffLocal: '09:00',
  finalizationDelayHours: 24,
}

/**
 * WP-96: a project's invoicing cadence. The owner alone states the rule, each
 * worker answers for themselves whether it may invoice their hours, and
 * everyone whose hours it governs can see when the next cutoff falls.
 */
@suite()
export class ProjectControllerCadenceTest extends BaseControllerTest {
  protected projectRepository: ProjectRepository
  protected projectManager: ProjectManager

  constructor() {
    super()

    this.projectRepository = this.container.get('ProjectRepository')
    this.projectManager = this.container.get('ProjectManager')
  }

  @test()
  async setCadence_asTheOwner_storesAVersionAndAnswersWithTheNextCutoff() {
    const { owner, project } = await this.project()

    const res = await this.setCadence(project, owner)

    expect(res.status).to.equal(200)
    expect(res.data?.current?.weekday).to.equal(1)
    expect(res.data?.current?.timezone).to.equal('America/New_York')
    expect(res.data?.current?.finalizationDelayHours).to.equal(24)
    expect(res.data?.canEdit).to.equal(true)

    const cutoff = new Date(res.data?.nextCutoff as string)

    expect(moment.tz(cutoff, 'America/New_York').format('dddd HH:mm')).to.equal(
      'Monday 09:00',
    )
    // The finalization delay, exactly: one instant, both ends derived from it.
    expect(
      new Date(res.data?.nextIssueAt as string).getTime() - cutoff.getTime(),
    ).to.equal(24 * 3600000)

    const stored = await runPromise(
      this.projectRepository.findOneByIdOrFail(project.id),
    )

    expect(stored.invoiceCadence).to.have.length(1)
  }

  /** The delay the owner did not state is the day the product promises. */
  @test()
  async setCadence_withoutADelay_takesTheDefaultDay() {
    const { owner, project } = await this.project()

    const res = await projectControllerSetCadence({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: this.auth(owner),
      body: {
        weekday: 1,
        timezone: 'America/New_York',
        cutoffLocal: '09:00',
      },
      throwOnError: true,
    })

    expect(res.data?.current?.finalizationDelayHours).to.equal(
      InvoiceCadence.DEFAULT_FINALIZATION_DELAY_HOURS,
    )
  }

  /**
   * The acceptance criterion: only the owner sets the rule money is billed
   * by. A worker asking is refused and the project is left exactly as it was.
   */
  @test()
  async setCadence_asAWorker_is403_andChangesNothing() {
    const { owner, worker, project } = await this.projectWithWorker()

    await this.setCadence(project, owner)

    const status = await this.statusOf(() => this.setCadence(project, worker))

    expect(status).to.equal(403)

    const stored = await runPromise(
      this.projectRepository.findOneByIdOrFail(project.id),
    )

    expect(stored.invoiceCadence).to.have.length(1)
    expect(stored.invoiceCadence?.[0].cutoffLocal).to.equal('09:00')
  }

  @test()
  async setCadence_asAViewer_is403() {
    const { viewer, project } = await this.projectWithWorker()

    expect(
      await this.statusOf(() => this.setCadence(project, viewer)),
    ).to.equal(403)
  }

  @test()
  async setCadence_asAStranger_is403() {
    const { project } = await this.project()
    const stranger = await this.userFixture.createUser()

    expect(
      await this.statusOf(() => this.setCadence(project, stranger)),
    ).to.equal(403)
  }

  /**
   * A new rule is a new version, never an overwrite: an invoice the schedule
   * has already issued was issued under the rule in force then.
   */
  @test()
  async setCadence_twice_keepsBothVersions() {
    const { owner, project } = await this.project()

    await this.setCadence(project, owner, {
      effectiveFromUnix: Date.parse('2026-01-01T00:00:00.000Z'),
    })
    const res = await this.setCadence(project, owner, {
      weekday: 5,
      cutoffLocal: '17:00',
      effectiveFromUnix: Date.parse('2026-06-01T00:00:00.000Z'),
    })

    expect(res.data?.versions).to.have.length(2)
    expect(res.data?.versions?.map((version) => version.weekday)).to.deep.equal(
      [1, 5],
    )
    expect(res.data?.current?.weekday).to.equal(5)
  }

  @test()
  async setCadence_withAZoneThatDoesNotExist_is400() {
    const { owner, project } = await this.project()

    expect(
      await this.statusOf(() =>
        this.setCadence(project, owner, { timezone: 'Mars/Olympus' }),
      ),
    ).to.equal(400)
  }

  @test()
  async setCadence_withACutoffThatIsNotATimeOfDay_is400() {
    const { owner, project } = await this.project()

    expect(
      await this.statusOf(() =>
        this.setCadence(project, owner, { cutoffLocal: 'lunchtime' }),
      ),
    ).to.equal(400)
  }

  /** The cutoff is when *your* hours stop being this week's, so you see it. */
  @test()
  async readCadence_showsTheNextCutoffToTheOwnerAndToWorkers() {
    const { owner, worker, project } = await this.projectWithWorker()

    const stated = await this.setCadence(project, owner)

    const byOwner = await this.readCadence(project, owner)
    const byWorker = await this.readCadence(project, worker)

    expect(byOwner.data?.nextCutoff).to.equal(stated.data?.nextCutoff)
    expect(byWorker.data?.nextCutoff).to.equal(stated.data?.nextCutoff)
    expect(byWorker.data?.current?.cutoffLocal).to.equal('09:00')
    // A worker sees the rule; only the owner is offered the pencil.
    expect(byOwner.data?.canEdit).to.equal(true)
    expect(byWorker.data?.canEdit).to.equal(false)
  }

  @test()
  async readCadence_asAViewer_is403() {
    const { owner, viewer, project } = await this.projectWithWorker()

    await this.setCadence(project, owner)

    expect(
      await this.statusOf(() => this.readCadence(project, viewer)),
    ).to.equal(403)
  }

  @test()
  async readCadence_withoutACadence_saysSoRatherThanGuessing() {
    const { owner, project } = await this.project()

    const res = await this.readCadence(project, owner)

    expect(res.data?.current).to.equal(null)
    expect(res.data?.nextCutoff).to.equal(null)
    expect(res.data?.versions).to.deep.equal([])
    expect(res.data?.consented).to.equal(null)
  }

  /**
   * The other acceptance criterion: consent is per worker, persisted, and
   * nobody is enrolled by default.
   */
  @test()
  async consent_isPersistedPerWorker() {
    const { owner, worker, project } = await this.projectWithWorker()

    await this.setCadence(project, owner)

    expect((await this.readCadence(project, worker)).data?.consented).to.equal(
      null,
    )

    const given = await projectControllerSetCadenceConsent({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: this.auth(worker),
      body: { consented: true },
      throwOnError: true,
    })

    expect(given.data?.consented).to.equal(true)
    expect((await this.readCadence(project, worker)).data?.consented).to.equal(
      true,
    )
    // One worker's answer is not anyone else's.
    expect((await this.readCadence(project, owner)).data?.consented).to.equal(
      null,
    )

    const stored = await runPromise(
      this.projectRepository.findOneByIdOrFail(project.id),
    )

    expect(stored.invoiceCadenceConsent).to.have.length(1)
    expect(stored.invoiceCadenceConsent?.[0].userId).to.equal(worker.id)
    expect(stored.invoiceCadenceConsent?.[0].consented).to.equal(true)
    expect(
      InvoiceCadence.consentingUserIds(stored.invoiceCadenceConsent),
    ).to.deep.equal([worker.id])
  }

  @test()
  async consent_canBeWithdrawn() {
    const { owner, worker, project } = await this.projectWithWorker()

    await this.setCadence(project, owner)
    await this.consent(project, worker, true)

    const withdrawn = await this.consent(project, worker, false)

    expect(withdrawn.data?.consented).to.equal(false)

    const stored = await runPromise(
      this.projectRepository.findOneByIdOrFail(project.id),
    )

    expect(stored.invoiceCadenceConsent).to.have.length(1)
    expect(
      InvoiceCadence.consentingUserIds(stored.invoiceCadenceConsent),
    ).to.deep.equal([])
  }

  @test()
  async consent_asAViewer_is403() {
    const { owner, viewer, project } = await this.projectWithWorker()

    await this.setCadence(project, owner)

    expect(
      await this.statusOf(() => this.consent(project, viewer, true)),
    ).to.equal(403)
  }

  /**
   * The cutoff read back through the manager, with the clock pinned either
   * side of a spring forward: the rule says 09:00 in New York, and that is
   * what a worker is shown in both halves of the year - a week of 167 hours.
   */
  @test()
  async readCadence_nextCutoffIsCorrectAcrossADstChange() {
    const { owner, worker, project } = await this.projectWithWorker()

    await this.setCadence(project, owner, {
      effectiveFromUnix: Date.parse('2026-01-01T00:00:00.000Z'),
    })

    const stored = await runPromise(
      this.projectRepository.findOneByIdOrFail(project.id),
    )

    const beforeTheChange = await runPromise(
      this.projectManager.readCadence(
        stored,
        worker,
        new Date('2026-03-01T12:00:00.000Z'),
      ),
    )
    const afterTheChange = await runPromise(
      this.projectManager.readCadence(
        stored,
        worker,
        new Date('2026-03-03T12:00:00.000Z'),
      ),
    )

    expect(beforeTheChange.nextCutoff).to.equal('2026-03-02T14:00:00.000Z')
    expect(afterTheChange.nextCutoff).to.equal('2026-03-09T13:00:00.000Z')
    expect(
      (Date.parse(afterTheChange.nextCutoff as string) -
        Date.parse(beforeTheChange.nextCutoff as string)) /
        3600000,
    ).to.equal(167)
    expect(
      moment
        .tz(afterTheChange.nextCutoff as string, 'America/New_York')
        .format('dddd HH:mm'),
    ).to.equal('Monday 09:00')
  }

  private async project() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    return { owner, project }
  }

  private async projectWithWorker() {
    const { owner, project } = await this.project()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()

    project.workerAddresses = [worker.address]
    project.viewerAddresses = [viewer.address]

    await runPromise(this.projectRepository.saveSingle(project))

    return { owner, worker, viewer, project }
  }

  private setCadence(
    project: Project,
    actor: User,
    overrides: Partial<typeof MONDAY_NY> & { effectiveFromUnix?: number } = {},
  ) {
    return projectControllerSetCadence({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: this.auth(actor),
      body: { ...MONDAY_NY, ...overrides },
      throwOnError: true,
    })
  }

  private readCadence(project: Project, actor: User) {
    return projectControllerReadCadence({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: this.auth(actor),
      throwOnError: true,
    })
  }

  private consent(project: Project, actor: User, consented: boolean) {
    return projectControllerSetCadenceConsent({
      client: this.apiClient(),
      path: { id: project.id as never },
      headers: this.auth(actor),
      body: { consented },
      throwOnError: true,
    })
  }

  private async statusOf(call: () => Promise<unknown>): Promise<number> {
    try {
      await call()
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } }).response
        ?.status

      if (status === undefined) {
        throw error
      }

      return status
    }

    throw new Error('The call was expected to be refused')
  }

  private auth(user: User) {
    return { Authorization: this.authenticator.getTokens(user).accessToken }
  }
}
