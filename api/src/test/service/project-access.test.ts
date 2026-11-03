import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import moment from 'moment'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { Project } from '@/entity/project'
import { Time } from '@/entity/time'
import { User } from '@/entity/user'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { TimeFixture } from '@/test/fixture/time-fixture'
import { UserFixture } from '@/test/fixture/user-fixture'
import { InvoiceManager } from '@/service/invoice-manager'
import { IConfigParameters } from '@/model/config'
import { ProjectAccess, ProjectRole } from '@/service/project-access'
import { runPromise } from '@/service/effect-bridge'
import { UserManager } from '@/service/user-manager'

const EMAIL = 'worker@example.com'
const EVM = '0x52908400098527886E0F7030069857D2E4169EE7'

const ADDRESSES = { email: EMAIL, EVM }

const ROLES = ['owner', 'worker', 'viewer', 'outsider'] as const
const PLANS = ['premium', 'lapsed'] as const
const MODES = ['saas', 'self-hosted'] as const

/**
 * Every combination that decides access, asserting that the per-row answer and
 * the query filter agree. These are the two forms "who may see this project"
 * takes, and the way they drifted apart is how access bugs started here.
 */
@suite()
export class ProjectAccessTest extends AbstractDatabaseIntegration {
  private access: ProjectAccess
  private fixture: ProjectFixture
  private users: UserFixture
  private userManager: UserManager
  private config: IConfigParameters
  private savedSecret: string

  constructor() {
    super()
    this.access = this.container.get('ProjectAccess')
    this.fixture = this.container.get('ProjectFixture')
    this.users = this.container.get('UserFixture')
    this.userManager = this.container.get('UserManager')
    this.config = this.container.get('parameters')
    this.savedSecret = this.config.entitlementSecret
  }

  async after() {
    this.config.entitlementSecret = this.savedSecret
    await super.after()
  }

  private async person(address?: string): Promise<User> {
    const user = await this.users.createUser()

    if (!address) return user

    user.address = address
    return runPromise(this.userManager.saveSingle(user))
  }

  private async project(
    plan: (typeof PLANS)[number],
    address?: string,
  ): Promise<{ project: Project; people: Record<string, User> }> {
    const owner = await this.users.createUser()
    owner.premium = plan === 'premium'
    await runPromise(this.userManager.saveSingle(owner))

    const worker = await this.person(address)
    const viewer = await this.users.createUser()
    const outsider = await this.users.createUser()
    const project = await this.fixture.createPersonal(owner)
    project.user = owner
    project.workerAddresses = [worker.address]
    project.viewerAddresses = [viewer.address]
    await this.conn.getRepository(Project).save(project)

    return { project, people: { owner, worker, viewer, outsider } }
  }

  private async filtered(
    project: Project,
    apply: (qb: never) => void,
  ): Promise<boolean> {
    const qb = this.conn
      .getRepository(Project)
      .createQueryBuilder('project')
      .innerJoin('project.user', 'owner')
      .where('project.id = :id', { id: project.id })

    apply(qb as never)

    return (await qb.getCount()) === 1
  }

  /** One entry by the owner, and one by the worker. */
  private async entries(project: Project, people: Record<string, User>) {
    const times = this.container.get<TimeFixture>('TimeFixture')
    const end = moment.utc().subtract(1, 'hour')
    const own = await times.create(
      project,
      end.clone().subtract(10, 'minutes').toDate(),
      end.toDate(),
      people.owner,
    )
    const worker = await times.create(
      project,
      end.clone().subtract(30, 'minutes').toDate(),
      end.clone().subtract(20, 'minutes').toDate(),
      people.worker,
    )

    return { own: own.id, worker: worker.id }
  }

  /** Which of `entries` the entries filter lists for this person. */
  private async listedEntries(
    project: Project,
    user: User,
    entries: Record<string, string>,
  ): Promise<string[]> {
    const qb = this.conn
      .getRepository(Time)
      .createQueryBuilder('time')
      .innerJoin('time.project', 'project')
      .innerJoin('project.user', 'owner')
      .where('project.id = :id', { id: project.id })

    this.access.filterEntries(qb, { project: 'project', owner: 'owner' }, user)

    const listed = (await qb.getMany()).map((time) => time.id)

    return Object.keys(entries)
      .filter((name) => listed.includes(entries[name]))
      .sort()
  }

  private expected(
    role: (typeof ROLES)[number],
    plan: (typeof PLANS)[number],
    mode: (typeof MODES)[number],
  ): ProjectRole | null {
    if (role === 'outsider') return null
    if (role === 'owner') return 'owner'
    return plan === 'lapsed' && mode === 'saas' ? null : role
  }

  @test()
  async theRowAndTheFilterAgreeOnEveryCombination() {
    for (const mode of MODES) {
      this.config.entitlementSecret = mode === 'saas' ? 'secret' : ''

      for (const plan of PLANS) {
        const { project, people } = await this.project(plan)
        const aliases = { project: 'project', owner: 'owner' }
        const entries = await this.entries(project, people)

        for (const role of ROLES) {
          const user = people[role]
          const label = `${role}, ${plan}, ${mode}`
          const expected = this.expected(role, plan, mode)

          expect(this.access.access(project, user), label).to.equal(expected)
          expect(this.access.role(project, user), label).to.equal(
            role === 'outsider' ? null : role,
          )
          expect(this.access.canWork(project, user), label).to.equal(
            expected === 'owner' || expected === 'worker',
          )
          expect(
            await this.filtered(project, (qb) =>
              this.access.filterProjects(qb, aliases, user, 'viewer'),
            ),
            `${label}: view filter`,
          ).to.equal(expected !== null)
          expect(
            await this.filtered(project, (qb) =>
              this.access.filterProjects(qb, aliases, user, 'worker'),
            ),
            `${label}: worker filter`,
          ).to.equal(expected === 'owner' || expected === 'worker')
          // Entries read no plan: a lapsed owner's worker keeps their own.
          expect(
            await this.listedEntries(project, user, entries),
            `${label}: entries filter`,
          ).to.deep.equal(
            role === 'owner'
              ? ['own', 'worker']
              : role === 'worker'
                ? ['worker']
                : [],
          )
        }
      }
    }
  }

  @test()
  async everyAddressFormatMatchesInBothForms() {
    this.config.entitlementSecret = 'secret'
    const aliases = { project: 'project', owner: 'owner' }

    for (const [chain, address] of Object.entries(ADDRESSES)) {
      const { project, people } = await this.project('premium', address)
      const { worker } = people

      expect(this.access.canWork(project, worker), chain).to.be.true
      expect(
        await this.filtered(project, (qb) =>
          this.access.filterProjects(qb, aliases, worker, 'worker'),
        ),
        `${chain}: filter`,
      ).to.be.true
    }
  }

  @test()
  async caseDoesNotDecideAccess() {
    this.config.entitlementSecret = 'secret'
    const aliases = { project: 'project', owner: 'owner' }
    const agree = async (stored: string, address: string, want: boolean) => {
      const { project, people } = await this.project('premium')
      project.workerAddresses = [stored]
      await this.conn.getRepository(Project).save(project)
      const user = Object.assign(new User(), people.worker, { address })

      expect(this.access.canWork(project, user), stored).to.equal(want)
      expect(
        await this.filtered(project, (qb) =>
          this.access.filterProjects(qb, aliases, user, 'worker'),
        ),
        `${stored}: filter`,
      ).to.equal(want)
    }

    await agree(EVM.toUpperCase().replace('0X', '0x'), EVM, true)
    await agree('Worker@Example.com', EMAIL, true)
    await agree('other@example.com', EMAIL, false)
  }

  /** A connected wallet pays invoices. Access reads `address` only. */
  @test()
  async aConnectedWalletGrantsNoAccess() {
    this.config.entitlementSecret = 'secret'
    const { project, people } = await this.project('premium')
    project.workerAddresses = [EVM]
    await this.conn.getRepository(Project).save(project)
    const google = Object.assign(new User(), people.outsider, {
      address: 'someone@example.com',
      connectedWallet: EVM,
    })

    expect(this.access.canWork(project, google)).to.be.false
    expect(
      await this.filtered(project, (qb) =>
        this.access.filterProjects(
          qb,
          { project: 'project', owner: 'owner' },
          google,
          'worker',
        ),
      ),
    ).to.be.false
  }

  @test()
  async aSelfHostedCollaboratorCanInvoice() {
    this.config.entitlementSecret = ''
    const { project, people } = await this.project('lapsed')
    const invoices = this.container.get<InvoiceManager>('InvoiceManager')

    // No time to bill yet, so nothing is issued, but it is not refused.
    const invoice = await runPromise(
      invoices.ensureForProject(project, people.worker),
    )

    expect(invoice ?? null).to.be.null
  }

  private entry(
    project: Project,
    author: User,
    fields: Partial<Time> = {},
  ): Time {
    const time = new Time()
    time.project = project
    time.user = author
    time.toAt = new Date(Date.now() - 3600_000)
    time.fromAt = new Date(Date.now() - 4200_000)
    return Object.assign(time, fields)
  }

  @test()
  async detailReachesTheOwnerOnlyOncePublished() {
    const { project, people } = await this.project('premium')
    const { owner, worker, viewer } = people
    project.reviewWindowHours = 24
    const old = new Date(Date.now() - 48 * 3600_000)
    const see = (time: Time, user: User) => this.access.canSeeDetail(time, user)

    const fresh = this.entry(project, worker)
    expect(see(fresh, worker), 'author').to.be.true
    expect(see(fresh, owner), 'owner before review').to.be.false
    expect(see(fresh, viewer), 'viewer').to.be.false
    expect(see(this.entry(project, worker, { toAt: old }), owner)).to.be.true
    expect(see(this.entry(project, worker, { publishedAt: new Date() }), owner))
      .to.be.true
    expect(see(this.entry(project, worker, { invoiceId: 'id' }), owner)).to.be
      .true
  }

  @test()
  async aMissingReviewWindowMeansADay() {
    const { project, people } = await this.project('premium')
    project.reviewWindowHours = undefined as never
    const { worker } = people

    expect(
      this.access.published(
        this.entry(project, worker, {
          toAt: new Date(Date.now() - 23 * 3600_000),
        }),
      ),
    ).to.be.false
    expect(
      this.access.published(
        this.entry(project, worker, {
          toAt: new Date(Date.now() - 25 * 3600_000),
        }),
      ),
    ).to.be.true
  }

  @test()
  async redactKeepsThisPersonsOwnDetail() {
    const { project, people } = await this.project('premium')
    const { owner, worker } = people
    const time = () => this.entry(project, worker, { note: 'private' })

    expect(this.access.redact(time(), worker).note).to.equal('private')
    const held = this.access.redact(time(), owner)
    expect(held.note).to.be.null
    expect(held.detailPendingReview).to.be.true
  }
}
