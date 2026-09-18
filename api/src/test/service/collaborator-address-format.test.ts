import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { EProjectState } from '@/model/project'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { ProjectManager } from '@/service/project-manager'
import { ProjectRepository } from '@/repository/project-repository'
import { UserFixture } from '@/test/fixture/user-fixture'
import { UserManager } from '@/service/user-manager'
import { WalletAddress } from '@/service/wallet-address'
import { runPromise } from '@/service/effect-bridge'

const TON_RAW =
  '0:4a5d1923244b0a845a7b5d8a29fd654b5a2a7a0331ce597e445b98dd23ab4025'
const TON_FRIENDLY = 'UQBKXRkjJEsKhFp7XYop_WVLWip6AzHOWX5EW5jdI6tAJQZJ'

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

  constructor() {
    super()

    this.userFixture = this.container.get('UserFixture')
    this.projectFixture = this.container.get('ProjectFixture')
    this.projectManager = this.container.get('ProjectManager')
    this.projectRepository = this.container.get('ProjectRepository')
    this.userManager = this.container.get('UserManager')
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
}
