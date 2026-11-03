import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { EProjectState } from '@/model/project'
import { ProjectFixture } from '@/test/fixture/project-fixture'
import { ProjectAccess } from '@/service/project-access'
import { ProjectManager } from '@/service/project-manager'
import { ProjectRepository } from '@/repository/project-repository'
import { UserFixture } from '@/test/fixture/user-fixture'
import { runPromise } from '@/service/effect-bridge'

/** A collaborator is an EVM address or an exact email, and nothing else. */
@suite()
export class CollaboratorAddressFormatTest extends AbstractDatabaseIntegration {
  protected userFixture: UserFixture
  protected projectFixture: ProjectFixture
  protected projectManager: ProjectManager
  protected projectRepository: ProjectRepository

  constructor() {
    super()

    this.userFixture = this.container.get('UserFixture')
    this.projectFixture = this.container.get('ProjectFixture')
    this.projectManager = this.container.get('ProjectManager')
    this.projectRepository = this.container.get('ProjectRepository')
  }

  private async saveWorkers(workerAddresses: string[]) {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )

    await runPromise(
      this.projectManager.editAndSave(project, {
        ...project,
        workerAddresses,
        viewerAddresses: [],
      } as never),
    )

    return runPromise(this.projectRepository.findOneByIdOrFail(project.id))
  }

  @test()
  async anEmailGrantsAccessToItsGoogleAccount() {
    const worker = await this.userFixture.createGoogleUser()
    const project = await this.saveWorkers([worker.address.toUpperCase()])

    expect(project.workerAddresses).to.deep.equal([worker.address])

    const access = this.container.get<ProjectAccess>('ProjectAccess')
    const withOwner = await runPromise(
      this.projectRepository.findOneByIdOrFail(project.id),
    )

    expect(access.role(withOwner, worker)).to.equal('worker')
  }

  @test()
  async bothCasingsDeduplicateToOneEntry() {
    const project = await this.saveWorkers([
      'someone@example.com',
      'SomeOne@Example.com',
    ])

    expect(project.workerAddresses).to.deep.equal(['someone@example.com'])
  }

  /** An EVM address keeps its EIP-55 checksum casing through the same path. */
  @test()
  async evmChecksumCasingSurvivesStorage() {
    const checksummed = '0xec1cA56B03F2E5Bc523598C756773a122B38311a'
    const project = await this.saveWorkers([checksummed])

    expect(project.workerAddresses).to.deep.equal([checksummed])
  }

  @test()
  async anythingElseIsRefused() {
    for (const address of [
      'not an address',
      'UQBKXRkjJEsKhFp7XYop_WVLWip6AzHOWX5EW5jdI6tAJQZJ',
      '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV',
    ]) {
      let error: Error | undefined

      try {
        await this.saveWorkers([address])
      } catch (e: unknown) {
        error = e as Error
      }

      expect(error?.message, address).to.match(/EVM address or an email/)
    }
  }
}
