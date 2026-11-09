import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import * as web3 from 'web3'

import { AbstractDatabaseIntegration } from '@/test/abstract-database.integration'
import { Project } from '@/entity/project'
import { User } from '@/entity/user'
import { EProjectState } from '@/model/project'
import { ProjectRepository } from '@/repository/project-repository'
import { UserRepository } from '@/repository/user-repository'
import { runPromise } from '@/service/effect-bridge'
import { TeamManager } from '@/service/team-manager'
import { WorkerSeats } from '@/service/worker-seats'
import { ProjectFixture } from '@/test/fixture/project-fixture'

const NOBODY = '0x52908400098527886E0F7030069857D2E4169EE7'

/**
 * A listed address names the account that signing in with it reaches, on
 * every page that shows who is listed. The hard case is a wallet that already
 * has two accounts, stored in different casings.
 */
@suite()
export class CollaboratorsTest extends AbstractDatabaseIntegration {
  private users: UserRepository
  private projects: ProjectRepository
  private fixture: ProjectFixture
  private team: TeamManager
  private seats: WorkerSeats

  constructor() {
    super()
    this.users = this.container.get('UserRepository')
    this.projects = this.container.get('ProjectRepository')
    this.fixture = this.container.get('ProjectFixture')
    this.team = this.container.get('TeamManager')
    this.seats = this.container.get('WorkerSeats')
  }

  /** One wallet, two accounts: the older stored in lower case. */
  private async twoAccounts() {
    const wallet = web3.eth.accounts.create()
    const older = await this.userFixture.createUserFromKeypair(wallet)
    older.address = wallet.address.toLowerCase()
    await runPromise(this.users.saveSingle(older))
    const newer = await this.userFixture.createUserFromKeypair(wallet)

    return {
      checksum: wallet.address,
      lowerCase: wallet.address.toLowerCase(),
      upperCase: `0x${wallet.address.slice(2).toUpperCase()}`,
      older,
      newer,
    }
  }

  private async listing(
    workers: string[],
    viewers: string[] = [],
  ): Promise<{ owner: User; project: Project }> {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.fixture.create(owner, EProjectState.ACTIVE)
    project.workerAddresses = workers
    project.viewerAddresses = viewers

    return {
      owner,
      project: await runPromise(this.projects.saveSingle(project)),
    }
  }

  private signsInAs(address: string): Promise<User> {
    return runPromise(this.users.findByAddressPublicOrFail(address))
  }

  @test()
  async theTeamPage_namesTheAccountSignInReaches() {
    const wallet = await this.twoAccounts()

    for (const spelling of [
      wallet.checksum,
      wallet.lowerCase,
      wallet.upperCase,
    ]) {
      const { owner } = await this.listing([spelling])
      const team = await this.team.read(owner)
      const listed = team.projects[0].people.find(
        (person) => person.role === 'worker',
      )

      expect(listed?.userId, spelling).to.equal(
        (await this.signsInAs(spelling)).id,
      )
    }
  }

  @test()
  async aProjectsPeople_areTheAccountsSignInReaches() {
    const wallet = await this.twoAccounts()

    for (const spelling of [
      wallet.checksum,
      wallet.lowerCase,
      wallet.upperCase,
    ]) {
      const { owner, project } = await this.listing([spelling], [spelling])
      const found = await runPromise(
        this.projects.findProjectWithAccess(project, owner),
      )
      const reached = (await this.signsInAs(spelling)).id

      expect(
        found?.workers.map(({ id }) => id),
        spelling,
      ).to.deep.equal([reached])
      expect(
        found?.viewers.map(({ id }) => id),
        spelling,
      ).to.deep.equal([reached])
    }
  }

  @test()
  async theSeatBill_namesTheAccountSignInReaches() {
    const wallet = await this.twoAccounts()

    for (const spelling of [
      wallet.checksum,
      wallet.lowerCase,
      wallet.upperCase,
    ]) {
      const { owner } = await this.listing([spelling])
      const { workers, connected } = await this.seats.inventory(owner)

      expect(connected, spelling).to.equal(1)
      expect(workers[0].address, spelling).to.equal(
        (await this.signsInAs(spelling)).address,
      )
    }
  }

  @test()
  async anAddressWrittenWithSpaces_stillNamesItsAccount() {
    const worker = await this.userFixture.createUser()
    const { owner } = await this.listing([` ${worker.address} `])

    const team = await this.team.read(owner)

    expect(team.projects[0].people[1].userId).to.equal(worker.id)
  }

  @test()
  async anAddressNobodyHasSignedInWith_isListedWithNoAccount() {
    const { owner, project } = await this.listing([NOBODY])

    const team = await this.team.read(owner)
    const found = await runPromise(
      this.projects.findProjectWithAccess(project, owner),
    )

    expect(team.projects[0].people[1]).to.include({
      address: NOBODY,
      userId: null,
      role: 'worker',
    })
    expect(found?.workers).to.deep.equal([])
    expect((await this.seats.inventory(owner)).connected).to.equal(0)
  }
}
