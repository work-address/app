import { faker } from '@faker-js/faker'
import * as web3 from 'web3'
import moment from 'moment'
import { In } from 'typeorm'

import { AppConfig } from '@/app/app-config'
import { AppContainer } from '@/app/app-container'
import { DbConnector } from '@/connector/db-connector'
import { Project } from '@/entity/project'
import { Time } from '@/entity/time'
import { User } from '@/entity/user'
import { Calc } from '@/service/calc'
import { EProjectState } from '@/model/project'
import { EUserRole } from '@/model/user'
import { InvoiceRepository } from '@/repository/invoice-repository'
import { ProjectRepository } from '@/repository/project-repository'
import { ProjectStatisticsRepository } from '@/repository/project-statistics-repository'
import { TimeRepository } from '@/repository/time-repository'
import { UserRepository } from '@/repository/user-repository'
import { Authenticator } from '@/service/auth/authenticator'
import { InvoiceManager } from '@/service/invoice-manager'
import { runPromise } from '@/service/effect-bridge'

/**
 * Populates the dev database with a plausible workspace so the dashboard has
 * something to render: projects with collaborators, tracked time across
 * several days, and invoices in both states.
 *
 * Dev/test tooling only — never run against a real database.
 *
 * Usage (from api/):
 *   pnpm run seed:demo                          # a demo owner plus workers
 *   pnpm run seed:demo -- --force               # wipe what this run reseeds, then reseed
 *   pnpm run seed:demo -- --projects 8          # more than the 4 default
 *   pnpm run seed:demo -- --address 0xabc…      # seed onto an existing wallet
 *   pnpm run seed:demo -- --token <jwt>         # same, resolved from a login token
 *
 * Without --force every path skips itself once its own rows exist. --force
 * means replace, never append: it deletes the projects it is about to recreate
 * (and their time and invoices, by cascade) so a second run leaves the row
 * counts where they were rather than stacking another copy on top.
 *
 * Unlike the marketing API, this service owns the user table, so `--address`
 * is enough to target a real account — there is no id to look up. `--token`
 * resolves the same thing from a login JWT, which is usually easier to get:
 *   JSON.parse(localStorage.getItem('wa.auth.session')).accessToken
 *
 * The owner is made premium: collaborators are a premium feature, so a free
 * demo account would have no workers and half the screens would be empty.
 */

const DEFAULT_PROJECTS = 4
const WORKERS_PER_PROJECT = 2
const DAYS_OF_HISTORY = 21
/** Each generated entry spans one tracker sampling window. */
const ENTRY_MINUTES = Calc.trackerIntervalMinutes
const SEED_TAG = '[seed:demo]'

/**
 * A believable desktop for the applications-usage chart. Weights skew the
 * random picks so the chart shows a few dominant apps and a long tail instead
 * of a uniform smear.
 */
const DEMO_PROCESSES: { name: string; weight: number }[] = [
  { name: 'Visual Studio Code', weight: 5 },
  { name: 'Google Chrome', weight: 4 },
  { name: 'Slack', weight: 2 },
  { name: 'Terminal', weight: 2 },
  { name: 'Figma', weight: 1 },
  { name: 'Notion', weight: 1 },
  { name: 'Spotify', weight: 1 },
  { name: 'Zoom', weight: 1 },
]

/**
 * Fixed keys so the demo accounts are the same on every run.
 *
 * Minting fresh wallets each time made the "already seeded" check useless -
 * it looked at a brand-new owner who by definition had nothing - so repeated
 * runs stacked instead of skipping, and `--force` had nothing to replace.
 *
 * Throwaway keys for local data only. They are in the repository precisely so
 * nobody is tempted to point them at anything real.
 */
const DEMO_KEYS = {
  owner: `0x${'11'.repeat(32)}`,
  workers: [`0x${'22'.repeat(32)}`, `0x${'33'.repeat(32)}`],
}

type Args = {
  force: boolean
  projectCount: number
  address?: string
  token?: string
}

function parseArgs(argv: string[]): Args {
  const value = (flag: string): string | undefined => {
    const index = argv.indexOf(flag)

    return index >= 0 ? argv[index + 1] : undefined
  }

  const projects = Number(value('--projects'))

  return {
    force: argv.includes('--force'),
    projectCount:
      Number.isFinite(projects) && projects > 0 ? projects : DEFAULT_PROJECTS,
    address: value('--address'),
    token: value('--token'),
  }
}

class DemoDataSeeder {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly timeRepository: TimeRepository,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly statisticsRepository: ProjectStatisticsRepository,
    private readonly invoiceManager: InvoiceManager,
  ) {}

  /**
   * A wallet-authenticated account, found or created for a fixed key. Address
   * is the identity here, not email.
   */
  private async findOrCreateUser(
    privateKey: string,
    premium = false,
  ): Promise<User> {
    const address = web3.eth.accounts.privateKeyToAccount(privateKey).address

    const existing = await runPromise(
      this.userRepository.findOneBy({ where: { address } }),
    )

    if (existing) {
      existing.premium = premium || Boolean(existing.premium)

      return runPromise(this.userRepository.saveSingle(existing))
    }

    const user = new User()

    user.address = address
    user.name = faker.person.fullName()
    user.email = faker.internet.email().toLowerCase()
    user.tz = 'UTC'
    user.rate = faker.number.int({ min: 25, max: 120 })
    user.roles = [EUserRole.ROLE_USER]
    user.premium = premium

    return runPromise(this.userRepository.saveSingle(user))
  }

  private async resolveOwner(address?: string): Promise<User> {
    if (address) {
      const existing = await runPromise(
        this.userRepository.findOneBy({
          where: { address },
        }),
      )

      if (!existing) {
        throw new Error(`No account with address ${address}`)
      }

      // Collaborators are premium-gated; without this the seeded workers
      // would be refused and the demo would show solo projects only.
      existing.premium = true

      return runPromise(this.userRepository.saveSingle(existing))
    }

    return this.findOrCreateUser(DEMO_KEYS.owner, true)
  }

  async seed(
    projectCount: number,
    force: boolean,
    address?: string,
  ): Promise<void> {
    const owner = await this.resolveOwner(address)

    const existing = await runPromise(
      this.projectRepository.findBy({
        where: { user: { id: owner.id } },
      }),
    )

    if (existing.length > 0) {
      if (!force) {
        console.log(
          `${SEED_TAG} ${owner.address} already has ${existing.length} projects — pass --force to replace them`,
        )

        return
      }

      // Invoice.project and Time.project don't cascade (the app only ever
      // soft-deletes projects), so a hard reseed has to clear the dependents
      // itself, invoices first — Time.invoice is SET NULL, the reverse order
      // would trip the FK.
      const projectIds = existing.map((project) => project.id)

      const invoices = await runPromise(
        this.invoiceRepository.findBy({
          where: { project: { id: In(projectIds) } },
        }),
      )
      await runPromise(this.invoiceRepository.removeMany(invoices))

      const times = await runPromise(
        this.timeRepository.findBy({
          where: { project: { id: In(projectIds) } },
        }),
      )
      await runPromise(this.timeRepository.removeMany(times))

      // Cached stats rows appear as soon as a dashboard requests them, so a
      // reseed after any app use has these to clear as well.
      const statistics = await runPromise(
        this.statisticsRepository.findBy({
          where: { project: { id: In(projectIds) } },
        }),
      )
      await runPromise(this.statisticsRepository.removeMany(statistics))

      await runPromise(this.projectRepository.removeMany(existing))
      console.log(`${SEED_TAG} removed ${existing.length} existing projects`)
    }

    const workers = await Promise.all(
      DEMO_KEYS.workers
        .slice(0, WORKERS_PER_PROJECT)
        .map((key) => this.findOrCreateUser(key)),
    )

    console.log(
      `${SEED_TAG} owner ${owner.address}, workers ${workers
        .map((worker) => worker.address)
        .join(', ')}`,
    )

    for (let index = 0; index < projectCount; index++) {
      await this.seedProject(owner, workers, index)
    }

    console.log(`${SEED_TAG} seeded ${projectCount} projects`)
  }

  private async seedProject(
    owner: User,
    workers: User[],
    index: number,
  ): Promise<void> {
    const project = new Project()

    project.title = faker.commerce.productName()
    project.text = faker.lorem.sentences(2)
    project.rateHour = faker.number.int({ min: 30, max: 150 })
    project.state = index === 0 ? EProjectState.INACTIVE : EProjectState.ACTIVE
    project.user = owner
    project.trackScreenshots = true
    project.trackProcesses = true
    // Every project except the first gets collaborators, so the demo covers
    // both the solo and the team case.
    project.workerAddresses =
      index === 0 ? [] : workers.map((worker) => worker.address)
    project.viewerAddresses = []

    const saved = await runPromise(this.projectRepository.saveSingle(project))

    const contributors = index === 0 ? [owner] : [owner, ...workers]

    for (const [position, contributor] of contributors.entries()) {
      await this.seedTime(saved, contributor, position)
    }

    // One invoice per contributor covering everything outstanding, then half
    // of them settled - so the dashboard shows both paid and unpaid money, and
    // `Time.isPaid` is exercised through the path that actually sets it.
    for (const [position, contributor] of contributors.entries()) {
      const invoice = await runPromise(
        this.invoiceManager.ensureForProject(saved, contributor),
      )

      if (invoice && position % 2 === 0) {
        await runPromise(this.invoiceManager.markPaid(invoice, contributor))
      }
    }
  }

  /**
   * `Time` is unique on (project, fromAt) — *without* the user — so two people
   * cannot start an entry at the same instant on the same project. Each
   * contributor is offset by a minute within the sampling grid so a project
   * with three of them seeds without colliding.
   */
  private async seedTime(
    project: Project,
    user: User,
    contributorIndex: number,
  ): Promise<void> {
    const entries: Time[] = []

    for (let day = 0; day < DAYS_OF_HISTORY; day++) {
      // Weekends left empty so the activity chart is not a flat block.
      const date = moment.utc().subtract(day, 'days')

      if (date.isoWeekday() > 5) {
        continue
      }

      const blocks = faker.number.int({ min: 6, max: 30 })

      for (let block = 0; block < blocks; block++) {
        const from = date
          .clone()
          .startOf('day')
          .add(9, 'hours')
          .add(block * ENTRY_MINUTES + contributorIndex, 'minutes')

        const time = new Time()

        time.project = project
        time.user = user
        time.note = faker.hacker.phrase()
        time.fromAt = from.toDate()
        time.toAt = from.clone().add(ENTRY_MINUTES, 'minutes').toDate()
        // Never above the block length: active minutes are a subset of the
        // wall-clock window, and exceeding it makes every derived percentage
        // read over 100%.
        time.minutesActive = faker.number.int({ min: 3, max: ENTRY_MINUTES })
        time.processes = this.pickProcesses(time.minutesActive)
        time.keyboardKeys = faker.number.int({ min: 0, max: 800 })
        time.mouseKeys = faker.number.int({ min: 0, max: 300 })
        time.mouseDistance = faker.number.float({ min: 0, max: 5000 })
        time.isPaid = false

        entries.push(time)
      }
    }

    await runPromise(this.timeRepository.saveMany(entries))
  }

  /**
   * Two to four weighted apps splitting the entry's active minutes, so the
   * dashboard's applications-usage chart has something to stack. Minutes sum
   * to exactly `minutesActive` — the chart's totals are compared against the
   * entry's own numbers, and drift there reads as a bug.
   */
  private pickProcesses(minutesActive: number): Time['processes'] {
    const count = faker.number.int({ min: 2, max: Math.min(4, minutesActive) })
    const names = new Set<string>()

    while (names.size < count) {
      names.add(
        faker.helpers.weightedArrayElement(
          DEMO_PROCESSES.map((process) => ({
            value: process.name,
            weight: process.weight,
          })),
        ),
      )
    }

    let remaining = minutesActive

    return [...names].map((name, index, all) => {
      const others = all.length - index - 1
      const timeMin =
        others === 0
          ? remaining
          : faker.number.int({ min: 1, max: remaining - others })

      remaining -= timeMin

      return { name, timeMin }
    })
  }

  /** Only for the summary line; the invoices themselves are made above. */
  async countInvoices(owner: User): Promise<number> {
    const [, count] = await runPromise(
      this.invoiceRepository.findAndCount(
        { filter: {}, sort: { createdAt: 'ASC' }, page: 0 },
        owner,
      ),
    )

    return count
  }
}

;(async () => {
  const { force, projectCount, address, token } = parseArgs(
    process.argv.slice(2),
  )

  const env = AppConfig.getEnv()
  const parameters = AppConfig.readConfig()

  if (env === 'production') {
    throw new Error('Refusing to seed demo data into production')
  }

  const connection = await new DbConnector(parameters, env).connect()
  const container = AppContainer.build(parameters, env)

  let resolvedAddress = address

  if (token) {
    const authenticator = container.get<Authenticator>('Authenticator')
    const user = await runPromise(
      authenticator.getUserFromJwtTokenOrThrowException(token),
    )

    console.log(`${SEED_TAG} resolved --token to ${user.address}`)
    resolvedAddress = user.address
  }

  const seeder = new DemoDataSeeder(
    container.get('UserRepository'),
    container.get('ProjectRepository'),
    container.get('TimeRepository'),
    container.get('InvoiceRepository'),
    container.get('ProjectStatisticsRepository'),
    container.get('InvoiceManager'),
  )

  await seeder.seed(projectCount, force, resolvedAddress)

  await connection.destroy()
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
