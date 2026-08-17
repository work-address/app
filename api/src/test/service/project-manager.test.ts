import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'

import { UserFixture } from '@/test/fixture/user-fixture'
import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'

import { ProjectManager } from '@/service/project-manager'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { ProjectRepository } from '@/repository/project-repository'
import { Project } from '@/entity/project'
import { EProjectState } from '@/model/project'

@suite()
export class ProjectManagerTest extends AbstractDatabaseIntegration {
  protected userFixture: UserFixture
  protected projectFixture: ProjectFixture
  protected projectManager: ProjectManager
  protected projectRepository: ProjectRepository

  constructor() {
    super()

    this.projectManager = this.container.get('ProjectManager')
    this.userFixture = this.container.get('UserFixture')
    this.projectFixture = this.container.get('ProjectFixture')
    this.projectRepository = this.container.get('ProjectRepository')
  }

  @test()
  async findProjectCheckAccess_personal() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)

    const result = await this.projectManager.findProjectCheckAccess(
      project,
      user,
    )

    expect(result?.id).to.be.equal(project.id)
  }

  @test()
  async findProjectCheckAccess_asWorker() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner)
    project.workerAddresses = [worker.address]
    await this.projectRepository.saveSingle(project)

    const result = await this.projectManager.findProjectCheckAccess(
      project,
      worker,
    )

    expect(result?.id).to.be.equal(project.id)
  }

  @test()
  async findProjectCheckAccess_asViewer() {
    const owner = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner)
    project.viewerAddresses = [viewer.address]
    await this.projectRepository.saveSingle(project)

    const result = await this.projectManager.findProjectCheckAccess(
      project,
      viewer,
    )

    expect(result?.id).to.be.equal(project.id)
  }

  @test()
  async findProjectCheckAccess_deniedForUnrelatedUser() {
    const owner = await this.userFixture.createUser()
    const outsider = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner)

    const result = await this.projectManager.findProjectCheckAccess(
      project,
      outsider,
    )

    expect(result).to.be.undefined
  }

  @test()
  async createAndSave_excludesOwnerFromAccessLists() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = new Project()

    project.title = 'access test'
    project.text = 'access test'
    project.state = EProjectState.ACTIVE
    project.user = owner
    project.workerAddresses = [owner.address, worker.address]
    project.viewerAddresses = [owner.address]

    const saved = await this.projectManager.createAndSave(project)

    expect(saved.workerAddresses).to.deep.equal([worker.address])
    expect(saved.viewerAddresses).to.deep.equal([])
  }

  @test()
  async createAndSave_allowsAccessAddressesWithNoAccountYet() {
    const owner = await this.userFixture.createUser()
    const project = new Project()

    project.title = 'access test'
    project.text = 'access test'
    project.state = EProjectState.ACTIVE
    project.user = owner
    // A collaborator may be granted access before their wallet has ever
    // signed in — the address is stored as-is, no matching user required.
    project.workerAddresses = ['0x000000000000000000000000000000deadbeef']
    project.viewerAddresses = []

    const saved = await this.projectManager.createAndSave(project)

    expect(saved.workerAddresses).to.deep.equal([
      '0x000000000000000000000000000000deadbeef',
    ])
  }

  @test()
  async createAndSave_matchesAccessAddressesCaseInsensitively() {
    const owner = await this.userFixture.createUser()
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

    const saved = await this.projectManager.createAndSave(project)

    expect(saved.workerAddresses).to.deep.equal([worker.address.toLowerCase()])
  }

  @test()
  async editAndSave_updatesOnlyWorkerAddresses_preservesViewerAddresses() {
    const owner = await this.userFixture.createUser()
    const workerA = await this.userFixture.createUser()
    const workerB = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner)
    project.workerAddresses = [workerA.address]
    project.viewerAddresses = [viewer.address]
    await this.projectRepository.saveSingle(project)

    const patch = new Project()
    patch.workerAddresses = [workerB.address]

    await this.projectManager.editAndSave(project, patch)

    const updated = await this.projectRepository.findOneByIdOrFail(project.id)
    expect(updated.workerAddresses).to.deep.equal([workerB.address])
    expect(updated.viewerAddresses).to.deep.equal([viewer.address])
  }

  @test()
  async editAndSave_deduplicatesAccessAddresses() {
    const owner = await this.userFixture.createUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(owner)

    const patch = new Project()
    patch.workerAddresses = [worker.address, worker.address]
    patch.viewerAddresses = [worker.address, worker.address]

    await this.projectManager.editAndSave(project, patch)

    const updated = await this.projectRepository.findOneByIdOrFail(project.id)
    expect(updated.workerAddresses).to.deep.equal([worker.address])
    expect(updated.viewerAddresses).to.deep.equal([worker.address])
  }
}
