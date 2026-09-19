import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import moment from 'moment'
import bs58 from 'bs58'
import { sign } from 'tweetnacl'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { EProjectState } from '@/model/project'
import { Project } from '@/entity/project'
import { User } from '@/entity/user'
import { TimeCreateDto } from '@/model/dto/time'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { ProjectManager } from '@/service/project-manager'
import { ProjectRepository } from '@/repository/project-repository'
import { TimeManager } from '@/service/time-manager'
import { TimeRepository } from '@/repository/time-repository'
import { UserFixture } from '@/test/fixture/user-fixture'
import { UserManager } from '@/service/user-manager'
import { UserRepository } from '@/repository/user-repository'
import { WalletAddress } from '@/service/wallet-address'
import { runPromise } from '@/service/effect-bridge'

const TON_RAW =
  '0:4a5d1923244b0a845a7b5d8a29fd654b5a2a7a0331ce597e445b98dd23ab4025'
const TON_FRIENDLY = 'UQBKXRkjJEsKhFp7XYop_WVLWip6AzHOWX5EW5jdI6tAJQZJ'
const TON_BOUNCEABLE = 'EQBKXRkjJEsKhFp7XYop_WVLWip6AzHOWX5EW5jdI6tAJVuM'
const EVM_CHECKSUM = '0xec1cA56B03F2E5Bc523598C756773a122B38311a'

/**
 * A TON wallet only ever shows the friendly spelling, so that is what an owner
 * pastes into the collaborator field. Access is granted by comparing against
 * the raw spelling stored on User.address — before canonicalisation on write,
 * such an entry validated, saved, and then silently granted nothing.
 */
@suite()
export class CollaboratorAddressFormatTest extends AbstractDatabaseIntegration {
  protected userFixture: UserFixture
  protected projectFixture: ProjectFixture
  protected projectManager: ProjectManager
  protected projectRepository: ProjectRepository
  protected userManager: UserManager
  protected userRepository: UserRepository
  protected timeManager: TimeManager
  protected timeRepository: TimeRepository

  constructor() {
    super()

    this.userFixture = this.container.get('UserFixture')
    this.projectFixture = this.container.get('ProjectFixture')
    this.projectManager = this.container.get('ProjectManager')
    this.projectRepository = this.container.get('ProjectRepository')
    this.userManager = this.container.get('UserManager')
    this.userRepository = this.container.get('UserRepository')
    this.timeManager = this.container.get('TimeManager')
    this.timeRepository = this.container.get('TimeRepository')
  }

  /**
   * A base58 Solana address with both lowercase and uppercase letters, and
   * the same string with one letter's case flipped - which base58 reads as a
   * different account.
   */
  private static solanaPair(): { address: string; caseVariant: string } {
    for (;;) {
      const address = bs58.encode(sign.keyPair().publicKey)

      if (!/[a-z]/.test(address) || !/[A-Z]/.test(address)) {
        continue
      }

      const at = address.search(/[a-zA-Z]/)
      const letter = address[at]
      const flipped =
        letter === letter.toLowerCase()
          ? letter.toUpperCase()
          : letter.toLowerCase()

      return {
        address,
        caseVariant: `${address.slice(0, at)}${flipped}${address.slice(at + 1)}`,
      }
    }
  }

  private async userWithAddress(address: string): Promise<User> {
    const user = await this.userFixture.createUser()

    user.address = address

    return runPromise(this.userManager.saveSingle(user))
  }

  /** Grants access the way the product does: through the project form. */
  private async share(
    project: Project,
    workerAddresses: string[],
    viewerAddresses: string[] = [],
  ): Promise<void> {
    await runPromise(
      this.projectManager.editAndSave(project, {
        ...project,
        workerAddresses,
        viewerAddresses,
      } as never),
    )
  }

  /** One ten-minute slice ending now, both ends from one clock read. */
  private static slice(projectId: string): TimeCreateDto {
    const now = moment.utc()

    return {
      fromIndex: 1,
      toIndex: 2,
      note: 'solana slice',
      keyboardKeys: 3,
      minutesActive: 7,
      mouseKeys: 2,
      mouseDistance: 5,
      fromAt: now.clone().subtract(10, 'minutes').toISOString(),
      toAt: now.toISOString(),
      projectId,
    }
  }

  private async listedProjectIds(user: User): Promise<string[]> {
    const [projects] = await runPromise(
      this.projectRepository.findAndCountAccessibleBy(
        { filter: {}, sort: { createdAt: 'ASC' }, page: 0 } as never,
        user,
      ),
    )

    return projects.map((project) => project.id)
  }

  private async searchedTimeIds(user: User, project: Project) {
    const [rows] = await runPromise(
      this.timeRepository.findAndCount(
        {
          filter: { projectId: project.id },
          sort: { createdAt: 'ASC' },
          page: 0,
        } as never,
        user,
      ),
    )

    return rows.map((row) => row.id)
  }

  private async tonWorker() {
    const worker = await this.userFixture.createUser()

    worker.address = TON_RAW
    await runPromise(this.userManager.saveSingle(worker))

    return worker
  }

  @test()
  async friendlyTonAddressGrantsAccessToTheRawAccount() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.tonWorker()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    // Exactly what a wallet puts on the clipboard.
    await runPromise(
      this.projectManager.editAndSave(project, {
        ...project,
        workerAddresses: [TON_FRIENDLY],
        viewerAddresses: [],
      } as never),
    )

    const reloaded = await runPromise(
      this.projectRepository.findOneByIdOrFail(project.id),
    )

    expect(reloaded.workerAddresses).to.deep.equal([TON_RAW])
    expect(reloaded.isWorker(worker)).to.be.true

    const accessible = await runPromise(
      this.projectRepository.findProjectWithAccess(project, worker),
    )
    expect(accessible?.id).to.be.equal(project.id)
  }

  /** Both spellings of one account are one collaborator, not two. */
  @test()
  async bothTonSpellingsDeduplicateToOneEntry() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    await runPromise(
      this.projectManager.editAndSave(project, {
        ...project,
        workerAddresses: [TON_FRIENDLY, TON_RAW],
        viewerAddresses: [],
      } as never),
    )

    const reloaded = await runPromise(
      this.projectRepository.findOneByIdOrFail(project.id),
    )

    expect(reloaded.workerAddresses).to.deep.equal([TON_RAW])
  }

  /** An EVM address keeps its EIP-55 checksum casing through the same path. */
  @test()
  async evmChecksumCasingSurvivesStorage() {
    const owner = await this.userFixture.createPremiumUser()
    const checksummed = '0xec1cA56B03F2E5Bc523598C756773a122B38311a'
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    await runPromise(
      this.projectManager.editAndSave(project, {
        ...project,
        workerAddresses: [checksummed],
        viewerAddresses: [],
      } as never),
    )

    const reloaded = await runPromise(
      this.projectRepository.findOneByIdOrFail(project.id),
    )

    expect(reloaded.workerAddresses).to.deep.equal([checksummed])
    expect(WalletAddress.toFriendly(checksummed)).to.be.equal(checksummed)
  }

  /**
   * G17. base58 keeps its case, so the canonical form of a Solana address is
   * the address as typed - and the SQL filters compared it with the stored
   * entry lowercased. A Solana worker matched in memory and in no query: the
   * project was missing from their list, POST /time could not find it, and
   * time search and totals were empty. These are the reads behind
   * /project/search, POST /time, /time/search and /time/totals.
   */
  @test()
  async solanaWorker_listsTheProject_tracksTime_andReadsIt() {
    const owner = await this.userFixture.createUser()
    const { address } = CollaboratorAddressFormatTest.solanaPair()
    const worker = await this.userWithAddress(address)
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    await this.share(project, [address])

    expect(await this.listedProjectIds(worker)).to.include(project.id)

    const slice = CollaboratorAddressFormatTest.slice(project.id)
    const [stored] = await runPromise(
      this.timeManager.createOrUpdateMany([slice], worker),
    )

    expect(stored.error).to.be.undefined
    expect(stored.id).to.be.a('string')

    expect(await this.searchedTimeIds(worker, project)).to.deep.equal([
      stored.id,
    ])

    await runPromise(
      this.projectRepository.findProjectWithAccessOrFail(project, worker),
    )
    const [totals] = await runPromise(
      this.timeRepository.getTotals(worker, project.id),
    )

    expect(totals.projectId).to.equal(project.id)
    expect(totals.minutesActive).to.equal(slice.minutesActive)
    expect(totals.keyboardKeys).to.equal(slice.keyboardKeys)
  }

  /** A Solana viewer reads the project and its time, and records none. */
  @test()
  async solanaViewer_readsButDoesNotTrack() {
    const owner = await this.userFixture.createUser()
    const { address } = CollaboratorAddressFormatTest.solanaPair()
    const viewer = await this.userWithAddress(address)
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    await this.share(project, [], [address])

    const [ownerRow] = await runPromise(
      this.timeManager.createOrUpdateMany(
        [CollaboratorAddressFormatTest.slice(project.id)],
        owner,
      ),
    )

    expect(await this.listedProjectIds(viewer)).to.include(project.id)
    expect(await this.searchedTimeIds(viewer, project)).to.deep.equal([
      ownerRow.id,
    ])

    const [totals] = await runPromise(
      this.timeRepository.getTotals(viewer, project.id),
    )
    expect(totals.projectId).to.equal(project.id)

    const [attempt] = await runPromise(
      this.timeManager.createOrUpdateMany(
        [CollaboratorAddressFormatTest.slice(project.id)],
        viewer,
      ),
    )
    expect(attempt.error?.name).to.equal('EntityNotFoundError')
  }

  /**
   * The fix must not be "lowercase both sides": two Solana addresses that
   * differ only in case are two accounts. An entry naming one grants the
   * other nothing, and does not resolve to it as a project worker.
   */
  @test()
  async solanaAddressDifferingOnlyInCase_isDenied() {
    const owner = await this.userFixture.createUser()
    const { address, caseVariant } = CollaboratorAddressFormatTest.solanaPair()
    const holder = await this.userWithAddress(address)
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    await this.share(project, [caseVariant], [caseVariant])

    expect(await this.listedProjectIds(holder)).to.not.include(project.id)
    expect(
      await runPromise(
        this.projectRepository.findProjectWithAccess(project, holder),
      ),
    ).to.be.undefined

    const [attempt] = await runPromise(
      this.timeManager.createOrUpdateMany(
        [CollaboratorAddressFormatTest.slice(project.id)],
        holder,
      ),
    )
    expect(attempt.error?.name).to.equal('EntityNotFoundError')
    expect(await this.searchedTimeIds(holder, project)).to.deep.equal([])

    const reloaded = await runPromise(
      this.projectRepository.findProjectWithAccess(project, owner),
    )
    expect(reloaded?.isWorker(holder)).to.be.false
    expect(reloaded?.workers).to.deep.equal([])
    expect(reloaded?.viewers).to.deep.equal([])

    const resolved = await runPromise(
      this.userRepository.findByAddresses([caseVariant]),
    )
    expect(resolved.map((user) => user.id)).to.not.include(holder.id)
    expect(
      await runPromise(this.userRepository.countByAddresses([caseVariant])),
    ).to.equal(0)
  }

  /** Resolution to an account is chain-aware too, not exact-string. */
  @test()
  async workersResolveToTheirAccountsOnEveryChain() {
    const owner = await this.userFixture.createUser()
    const { address: solana } = CollaboratorAddressFormatTest.solanaPair()
    const solanaWorker = await this.userWithAddress(solana)
    const tonWorker = await this.userWithAddress(TON_RAW)
    const evmWorker = await this.userWithAddress(EVM_CHECKSUM)
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    await this.share(project, [
      solana,
      TON_FRIENDLY,
      EVM_CHECKSUM.toLowerCase(),
    ])

    const reloaded = await runPromise(
      this.projectRepository.findProjectWithAccess(project, owner),
    )

    expect(reloaded?.workers.map((user) => user.id)).to.deep.equal([
      solanaWorker.id,
      tonWorker.id,
      evmWorker.id,
    ])

    for (const worker of [solanaWorker, tonWorker, evmWorker]) {
      expect(await this.listedProjectIds(worker), worker.address).to.include(
        project.id,
      )
    }
  }

  /**
   * A friendly TON spelling saved before addresses were canonicalised on
   * write is still in the column as typed. `Project.isWorker` has always
   * counted it; the SQL filters now agree instead of silently granting
   * nothing.
   */
  @test()
  async legacyFriendlyTonEntry_grantsInSqlAsItDoesInMemory() {
    const owner = await this.userFixture.createUser()
    const worker = await this.tonWorker()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    // Written straight to the column, as the form did before 089cc58.
    project.workerAddresses = [TON_BOUNCEABLE]
    await runPromise(this.projectRepository.saveSingle(project))

    expect(project.isWorker(worker)).to.be.true

    const accessible = await runPromise(
      this.projectRepository.findProjectWithAccess(project, worker),
    )
    expect(accessible?.id).to.equal(project.id)
    expect(accessible?.workers.map((user) => user.id)).to.deep.equal([
      worker.id,
    ])
  }

  /**
   * The SQL predicate and `WalletAddress.isSame` answer every pair alike:
   * whatever the stored spelling, the database says "same account" exactly
   * when the TypeScript does.
   */
  @test()
  async sqlMembershipAgreesWithIsSameForEveryPair() {
    const { address: solana, caseVariant } =
      CollaboratorAddressFormatTest.solanaPair()
    const addresses = [
      solana,
      caseVariant,
      ` ${solana} `,
      TON_RAW,
      TON_RAW.toUpperCase(),
      TON_FRIENDLY,
      TON_BOUNCEABLE,
      EVM_CHECKSUM,
      EVM_CHECKSUM.toLowerCase(),
      EVM_CHECKSUM.toUpperCase(),
      // A checksum typo: `Address.parse` refuses it, so it is only itself.
      'UQBKXRkjJEsKhFp7XYop_WVLWip6AzHOWX5EW5jdI6tAJQZZ',
    ]

    for (const stored of addresses) {
      for (const user of addresses) {
        const [row] = await this.conn.query(
          `SELECT ${WalletAddress.canonicalSql('$1::text')} = ANY($2::text[]) AS same`,
          [stored, WalletAddress.matchForms(user)],
        )

        expect(row.same, `${stored} vs ${user}`).to.equal(
          WalletAddress.isSame(stored, user),
        )
      }
    }
  }
}
