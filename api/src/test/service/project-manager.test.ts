import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'

import { UserFixture } from '@/test/fixture/user-fixture'
import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'

import { ProjectManager } from '@/service/project-manager'
import { UserManager } from '@/service/user-manager'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { ProjectRepository } from '@/repository/project-repository'
import { Project } from '@/entity/project'
import { EProjectState } from '@/model/project'
import { runPromise } from '@/service/effect-bridge'

@suite()
export class ProjectManagerTest extends AbstractDatabaseIntegration {
  protected userFixture: UserFixture
  protected projectFixture: ProjectFixture
  protected projectManager: ProjectManager
  protected projectRepository: ProjectRepository
  protected userManager: UserManager

  constructor() {
    super()

    this.projectManager = this.container.get('ProjectManager')
    this.userFixture = this.container.get('UserFixture')
    this.projectFixture = this.container.get('ProjectFixture')
    this.projectRepository = this.container.get('ProjectRepository')
    this.userManager = this.container.get('UserManager')
  }

  @test()
  async findProjectCheckAccess_personal() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)

    const result = await runPromise(
      this.projectManager.findProjectCheckAccess(project, user),
    )

    expect(result?.id).to.be.equal(project.id)
  }

  @test()
  async findProjectCheckAccess_asWorker() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner)
    project.workerAddresses = [worker.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const result = await runPromise(
      this.projectManager.findProjectCheckAccess(project, worker),
    )

    expect(result?.id).to.be.equal(project.id)
  }

  @test()
  async findProjectCheckAccess_asViewer() {
    const owner = await this.userFixture.createPremiumUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner)
    project.viewerAddresses = [viewer.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const result = await runPromise(
      this.projectManager.findProjectCheckAccess(project, viewer),
    )

    expect(result?.id).to.be.equal(project.id)
  }

  @test()
  async findProjectCheckAccess_deniedForUnrelatedUser() {
    const owner = await this.userFixture.createPremiumUser()
    const outsider = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner)

    const result = await runPromise(
      this.projectManager.findProjectCheckAccess(project, outsider),
    )

    expect(result).to.be.undefined
  }

  @test()
  async createAndSave_excludesOwnerFromAccessLists() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = new Project()

    project.title = 'access test'
    project.text = 'access test'
    project.state = EProjectState.ACTIVE
    project.user = owner
    project.workerAddresses = [owner.address, worker.address]
    project.viewerAddresses = [owner.address]

    const saved = await runPromise(this.projectManager.createAndSave(project))

    expect(saved.workerAddresses).to.deep.equal([worker.address])
    expect(saved.viewerAddresses).to.deep.equal([])
  }

  @test()
  async createAndSave_allowsAccessAddressesWithNoAccountYet() {
    const owner = await this.userFixture.createPremiumUser()
    const project = new Project()

    project.title = 'access test'
    project.text = 'access test'
    project.state = EProjectState.ACTIVE
    project.user = owner
    // A collaborator may be granted access before their wallet has ever
    // signed in — the address is stored as-is, no matching user required.
    project.workerAddresses = ['0x000000000000000000000000000000deadbeef']
    project.viewerAddresses = []

    const saved = await runPromise(this.projectManager.createAndSave(project))

    expect(saved.workerAddresses).to.deep.equal([
      '0x000000000000000000000000000000deadbeef',
    ])
  }

  @test()
  async createAndSave_matchesAccessAddressesCaseInsensitively() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = new Project()

    project.title = 'access test'
    project.text = 'access test'
    project.state = EProjectState.ACTIVE
    project.user = owner
    // A collaborator's address as stored (e.g. EIP-55 checksummed) may not
    // match the casing a project owner types/pastes into the form.
    project.workerAddresses = [worker.address.toLowerCase()]
    project.viewerAddresses = []

    const saved = await runPromise(this.projectManager.createAndSave(project))

    expect(saved.workerAddresses).to.deep.equal([worker.address.toLowerCase()])
  }

  @test()
  async editAndSave_updatesOnlyWorkerAddresses_preservesViewerAddresses() {
    const owner = await this.userFixture.createPremiumUser()
    const workerA = await this.userFixture.createUser()
    const workerB = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner)
    project.workerAddresses = [workerA.address]
    project.viewerAddresses = [viewer.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const patch = new Project()
    patch.workerAddresses = [workerB.address]

    await runPromise(this.projectManager.editAndSave(project, patch))

    const updated = await runPromise(
      this.projectRepository.findOneByIdOrFail(project.id),
    )
    expect(updated.workerAddresses).to.deep.equal([workerB.address])
    expect(updated.viewerAddresses).to.deep.equal([viewer.address])
  }

  @test()
  async editAndSave_deduplicatesAccessAddresses() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner)

    const patch = new Project()
    patch.workerAddresses = [worker.address, worker.address]
    patch.viewerAddresses = [worker.address, worker.address]

    await runPromise(this.projectManager.editAndSave(project, patch))

    const updated = await runPromise(
      this.projectRepository.findOneByIdOrFail(project.id),
    )
    expect(updated.workerAddresses).to.deep.equal([worker.address])
    expect(updated.viewerAddresses).to.deep.equal([worker.address])
  }

  /**
   * Collaborators are free: a free owner adds a worker and a viewer, and
   * nothing about the owner's plan is consulted.
   */
  @test()
  async createAndSave_acceptsAccessAddressesForNonPremiumOwner() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = new Project()

    project.title = 'access test'
    project.text = 'access test'
    project.state = EProjectState.ACTIVE
    project.user = owner
    project.workerAddresses = [worker.address]
    project.viewerAddresses = [viewer.address]

    const saved = await runPromise(this.projectManager.createAndSave(project))
    const reloaded = await runPromise(
      this.projectRepository.findOneByIdOrFail(saved.id),
    )

    expect(owner.premium).to.not.be.ok
    expect(reloaded.workerAddresses).to.deep.equal([worker.address])
    expect(reloaded.viewerAddresses).to.deep.equal([viewer.address])
  }

  @test()
  async createAndSave_allowsEmptyAccessAddressesForNonPremiumOwner() {
    const owner = await this.userFixture.createUser()
    const project = new Project()

    project.title = 'access test'
    project.text = 'access test'
    project.state = EProjectState.ACTIVE
    project.user = owner
    project.workerAddresses = []
    project.viewerAddresses = []

    const saved = await runPromise(this.projectManager.createAndSave(project))

    expect(saved.workerAddresses).to.deep.equal([])
    expect(saved.viewerAddresses).to.deep.equal([])
  }

  @test()
  async editAndSave_acceptsAccessAddressesForNonPremiumOwner() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner)

    const patch = new Project()
    patch.workerAddresses = [worker.address]
    patch.viewerAddresses = [viewer.address]

    await runPromise(this.projectManager.editAndSave(project, patch))

    const updated = await runPromise(
      this.projectRepository.findOneByIdOrFail(project.id),
    )
    expect(owner.premium).to.not.be.ok
    expect(updated.workerAddresses).to.deep.equal([worker.address])
    expect(updated.viewerAddresses).to.deep.equal([viewer.address])
  }

  /**
   * The owner's plan governs retention only. A subscription lapsing or
   * resuming must neither drop nor restore anyone's access - otherwise a
   * client's billing hiccup locks their contractor out mid-engagement.
   */
  @test()
  async findProjectCheckAccess_unaffectedByTheOwnersPremiumFlag() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner)
    project.workerAddresses = [worker.address]
    project.viewerAddresses = [viewer.address]
    await runPromise(this.projectRepository.saveSingle(project))

    const expectAccess = async () => {
      for (const member of [owner, worker, viewer]) {
        const found = await runPromise(
          this.projectManager.findProjectCheckAccess(project, member),
        )

        expect(found?.id, `premium=${owner.premium}`).to.equal(project.id)
      }
    }

    await expectAccess()

    owner.premium = false
    await runPromise(this.userManager.saveSingle(owner))
    await expectAccess()

    owner.premium = true
    await runPromise(this.userManager.saveSingle(owner))
    await expectAccess()

    const reloaded = await runPromise(
      this.projectRepository.findOneByIdOrFail(project.id),
    )
    expect(reloaded.workerAddresses).to.deep.equal([worker.address])
    expect(reloaded.viewerAddresses).to.deep.equal([viewer.address])
  }

  @test()
  async isWorkerAndIsViewer_matchTheSqlAccessFilters() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner)
    project.user = owner
    project.workerAddresses = [worker.address.toUpperCase()]
    project.viewerAddresses = [viewer.address]

    // Address casing must not decide access.
    expect(project.isWorker(worker)).to.be.true
    expect(project.isViewer(worker)).to.be.true
    expect(project.isWorker(viewer)).to.be.false
    expect(project.isViewer(viewer)).to.be.true

    // Neither must the owner's plan - the SQL filters no longer read it.
    owner.premium = false
    expect(project.isWorker(worker)).to.be.true
    expect(project.isViewer(worker)).to.be.true
    expect(project.isViewer(viewer)).to.be.true
    expect(project.isOwner(owner)).to.be.true
  }

  /**
   * An owner edits the list freely whatever their plan: removing someone and
   * adding someone back are both ordinary edits.
   */
  @test()
  async editAndSave_letsANonPremiumOwnerRemoveAndAddCollaborators() {
    const owner = await this.userFixture.createPremiumUser()
    const workerA = await this.userFixture.createUser()
    const workerB = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner)

    const granted = new Project()
    granted.workerAddresses = [workerA.address, workerB.address]
    await runPromise(this.projectManager.editAndSave(project, granted))

    owner.premium = false
    await runPromise(this.userManager.saveSingle(owner))

    const reloaded = await runPromise(
      this.projectRepository.findOneByIdOrFail(project.id),
    )

    const revoke = new Project()
    revoke.workerAddresses = [workerA.address]
    await runPromise(this.projectManager.editAndSave(reloaded, revoke))

    const afterRevoke = await runPromise(
      this.projectRepository.findOneByIdOrFail(project.id),
    )
    expect(afterRevoke.workerAddresses).to.deep.equal([workerA.address])

    const regrant = new Project()
    regrant.workerAddresses = [workerA.address, workerB.address]
    await runPromise(this.projectManager.editAndSave(afterRevoke, regrant))

    const afterRegrant = await runPromise(
      this.projectRepository.findOneByIdOrFail(project.id),
    )
    expect(afterRegrant.workerAddresses).to.deep.equal([
      workerA.address,
      workerB.address,
    ])
  }
}
