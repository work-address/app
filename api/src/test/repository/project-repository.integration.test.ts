import { expect } from 'chai'
import { suite, test } from '@testdeck/mocha'
import * as web3 from 'web3'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { ProjectRepository } from '@/repository/project-repository'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { EProjectState } from '@/model/project'

@suite()
export class ProjectRepositoryIntegrationTest extends AbstractDatabaseIntegration {
  protected projectRepository: ProjectRepository
  protected projectFixture: ProjectFixture

  constructor() {
    super()

    this.projectRepository = this.container.get('ProjectRepository')
    this.projectFixture = this.container.get('ProjectFixture')
  }

  @test()
  async findProjectWithAccess_asOwnerWorkerAndViewer() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    project.workerAddresses = [worker.address]
    project.viewerAddresses = [viewer.address]
    await this.projectRepository.saveSingle(project)

    const asOwner = await this.projectRepository.findProjectWithAccess(
      project,
      owner,
    )
    const asWorker = await this.projectRepository.findProjectWithAccess(
      project,
      worker,
    )
    const asViewer = await this.projectRepository.findProjectWithAccess(
      project,
      viewer,
    )

    expect(asOwner?.id).to.equal(project.id)
    expect(asWorker?.id).to.equal(project.id)
    expect(asViewer?.id).to.equal(project.id)
    expect(asOwner?.workerAddresses).to.deep.equal([worker.address])
    expect(asOwner?.viewerAddresses).to.deep.equal([viewer.address])
    expect(asOwner?.workers).to.have.length(1)
    expect(asOwner?.workers?.[0]?.id).to.equal(worker.id)
    expect(asOwner?.viewers).to.have.length(1)
    expect(asOwner?.viewers?.[0]?.id).to.equal(viewer.id)
    expect(asWorker?.workers?.[0]?.id).to.equal(worker.id)
    expect(asWorker?.viewers?.[0]?.id).to.equal(viewer.id)
    expect(asViewer?.workers?.[0]?.id).to.equal(worker.id)
    expect(asViewer?.viewers?.[0]?.id).to.equal(viewer.id)
  }

  @test()
  async findProjectWithAccess_deniedForUnrelatedUser() {
    const owner = await this.userFixture.createUser()
    const outsider = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    const result = await this.projectRepository.findProjectWithAccess(
      project,
      outsider,
    )

    expect(result).to.be.undefined
  }

  @test()
  async findAndCountAccessibleBy_asOwnerWorkerAndViewer() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const viewer = await this.userFixture.createUser()
    const outsider = await this.userFixture.createUser()
    const privateProject = await this.projectFixture.createPersonal(owner)
    const shared = await this.projectFixture.create(owner, EProjectState.ACTIVE)
    shared.workerAddresses = [worker.address]
    shared.viewerAddresses = [viewer.address]
    await this.projectRepository.saveSingle(shared)

    const [ownerRows] = await this.projectRepository.findAndCountAccessibleBy(
      { filter: {}, sort: { createdAt: 'ASC' }, page: 0 },
      owner,
    )
    const [workerRows] = await this.projectRepository.findAndCountAccessibleBy(
      { filter: {}, sort: { createdAt: 'ASC' }, page: 0 },
      worker,
    )
    const [viewerRows] = await this.projectRepository.findAndCountAccessibleBy(
      { filter: {}, sort: { createdAt: 'ASC' }, page: 0 },
      viewer,
    )
    const [outsiderRows, outsiderCount] =
      await this.projectRepository.findAndCountAccessibleBy(
        {
          filter: { projectId: shared.id },
          sort: { createdAt: 'ASC' },
          page: 0,
        },
        outsider,
      )

    const ownerIds = ownerRows.map((row) => row.id)
    const workerIds = workerRows.map((row) => row.id)
    const viewerIds = viewerRows.map((row) => row.id)

    expect(ownerIds).to.include(privateProject.id)
    expect(ownerIds).to.include(shared.id)
    expect(workerIds).to.include(shared.id)
    expect(workerIds).to.not.include(privateProject.id)
    expect(viewerIds).to.include(shared.id)
    expect(viewerIds).to.not.include(privateProject.id)
    expect(outsiderRows).to.deep.equal([])
    expect(outsiderCount).to.equal(0)

    const sharedForOwner = ownerRows.find((row) => row.id === shared.id)
    const sharedForWorker = workerRows.find((row) => row.id === shared.id)
    const sharedForViewer = viewerRows.find((row) => row.id === shared.id)

    expect(sharedForOwner?.workerAddresses).to.deep.equal([worker.address])
    expect(sharedForOwner?.viewerAddresses).to.deep.equal([viewer.address])
    expect(sharedForOwner?.workers).to.have.length(1)
    expect(sharedForOwner?.workers?.[0]?.id).to.equal(worker.id)
    expect(sharedForOwner?.viewers).to.have.length(1)
    expect(sharedForOwner?.viewers?.[0]?.id).to.equal(viewer.id)
    expect(sharedForWorker?.workers?.[0]?.id).to.equal(worker.id)
    expect(sharedForWorker?.viewers?.[0]?.id).to.equal(viewer.id)
    expect(sharedForViewer?.workers?.[0]?.id).to.equal(worker.id)
    expect(sharedForViewer?.viewers?.[0]?.id).to.equal(viewer.id)

    const privateForOwner = ownerRows.find(
      (row) => row.id === privateProject.id,
    )
    expect(privateForOwner?.workers ?? []).to.deep.equal([])
    expect(privateForOwner?.viewers ?? []).to.deep.equal([])
  }

  @test()
  async findAndCountAccessibleBy_attachesWorkersAndViewersForMultipleProjects() {
    const owner = await this.userFixture.createUser()
    const workerA = await this.userFixture.createUser()
    const workerB = await this.userFixture.createUser()
    const viewerA = await this.userFixture.createUser()
    const viewerB = await this.userFixture.createUser()
    const first = await this.projectFixture.create(owner, EProjectState.ACTIVE)
    first.workerAddresses = [workerA.address]
    first.viewerAddresses = [viewerA.address]
    await this.projectRepository.saveSingle(first)
    const second = await this.projectFixture.create(owner, EProjectState.ACTIVE)
    second.workerAddresses = [workerB.address]
    second.viewerAddresses = [viewerB.address]
    await this.projectRepository.saveSingle(second)

    const [rows] = await this.projectRepository.findAndCountAccessibleBy(
      { filter: {}, sort: { createdAt: 'ASC' }, page: 0 },
      owner,
    )

    const firstRow = rows.find((row) => row.id === first.id)
    const secondRow = rows.find((row) => row.id === second.id)

    expect(firstRow?.workers?.map((user) => user.id)).to.deep.equal([
      workerA.id,
    ])
    expect(firstRow?.viewers?.map((user) => user.id)).to.deep.equal([
      viewerA.id,
    ])
    expect(secondRow?.workers?.map((user) => user.id)).to.deep.equal([
      workerB.id,
    ])
    expect(secondRow?.viewers?.map((user) => user.id)).to.deep.equal([
      viewerB.id,
    ])
  }

  @test()
  async findAndCountAccessibleBy_attachesWorkerCaseInsensitively() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(owner, EProjectState.ACTIVE)
    // Stored casing (e.g. EIP-55 checksummed) may differ from what the
    // project owner typed when adding this collaborator.
    project.workerAddresses = [worker.address.toLowerCase()]
    await this.projectRepository.saveSingle(project)

    const [rows] = await this.projectRepository.findAndCountAccessibleBy(
      { filter: {}, sort: { createdAt: 'ASC' }, page: 0 },
      owner,
    )

    const row = rows.find((r) => r.id === project.id)

    expect(row?.workers?.map((user) => user.id)).to.deep.equal([worker.id])
  }

  @test()
  async findAndCountAccessibleBy_grantsAccessAfterLateOnboarding() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(owner, EProjectState.ACTIVE)
    const pendingKeypair = web3.eth.accounts.create()
    project.workerAddresses = [pendingKeypair.address]
    await this.projectRepository.saveSingle(project)

    // Before the invited wallet has ever signed in, it has no access yet —
    // there's no user account to check access for.
    const notYetOnboarded = await this.userFixture.createUser()
    const [beforeOnboardingRows] =
      await this.projectRepository.findAndCountAccessibleBy(
        { filter: { projectId: project.id }, sort: { createdAt: 'ASC' }, page: 0 },
        notYetOnboarded,
      )
    expect(beforeOnboardingRows).to.deep.equal([])

    // Once that same wallet actually signs in (creating its user account),
    // it immediately gets access — no separate re-invite step required.
    const nowOnboarded = await this.userFixture.createUserFromKeypair(
      pendingKeypair,
    )
    const [afterOnboardingRows] =
      await this.projectRepository.findAndCountAccessibleBy(
        { filter: { projectId: project.id }, sort: { createdAt: 'ASC' }, page: 0 },
        nowOnboarded,
      )

    expect(afterOnboardingRows.map((row) => row.id)).to.deep.equal([
      project.id,
    ])
    expect(afterOnboardingRows[0]?.workers?.map((u) => u.id)).to.deep.equal([
      nowOnboarded.id,
    ])
  }
}
